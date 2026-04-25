import axios from 'axios';

/** 바이비트 퍼블릭 API 베이스 URL */
const BYBIT_API_BASE = 'https://api.bybit.com';

/** 지정한 ms만큼 대기한다 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * API 호출을 최대 maxRetries번 재시도한다
 * - 레이트 리밋 등 일시적 오류에 대응
 * - 재시도 간격: 2초 → 4초 → 6초 (선형 증가)
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const waitMs = attempt * 2000; // 2s, 4s, 6s
        console.warn(`[Fetcher] 재시도 ${attempt}/${maxRetries - 1} — ${waitMs / 1000}초 후 재시도`);
        await sleep(waitMs);
      }
    }
  }
  throw lastError;
}

/** 바이비트 캔들(Kline) 데이터 구조 */
export interface Candle {
  openTime: number;        // 캔들 시작 시각 (Unix ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;          // 코인 기준 거래량
  turnover: number;        // USDT 기준 거래대금
  fundingRate?: number;    // 4H BTCUSDT만: 캔들 마감 시점 예측 펀딩비율
  openInterest?: number;   // 1D BTCUSDT만: 캔들 마감 시점 미결제약정 (코인 기준)
}

/** 바이비트 응답 배열을 Candle 객체로 변환한다 */
function parseCandle(raw: string[]): Candle {
  return {
    openTime: Number(raw[0]),
    open: Number(raw[1]),
    high: Number(raw[2]),
    low: Number(raw[3]),
    close: Number(raw[4]),
    volume: Number(raw[5]),
    turnover: Number(raw[6]),
  };
}

/**
 * 바이비트에서 심볼의 OHLCV 캔들 데이터를 가져온다
 * - interval: '1', '5', '15', '30', '60', '240', 'D' 등
 * - 반환 순서: 최신 캔들이 index 0 (내림차순)
 */
export async function fetchCandles(
  symbol: string,
  interval: string,
  limit: number = 21
): Promise<Candle[]> {
  return withRetry(async () => {
    const url = `${BYBIT_API_BASE}/v5/market/kline`;
    const res = await axios.get(url, {
      params: { category: 'linear', symbol, interval, limit },
    });

    if (res.data.retCode !== 0) {
      throw new Error(`[Fetcher] 캔들 조회 실패 (${symbol}): ${res.data.retMsg}`);
    }

    // 바이비트는 최신이 index 0인 배열로 반환
    return (res.data.result.list as string[][]).map(parseCandle);
  });
}

/** 바이비트 선물 티커 데이터 구조 */
export interface Ticker {
  symbol: string;
  lastPrice: number;       // 현재가
  prevPrice24h: number;    // 24h 전 가격
  price24hPcnt: number;    // 24h 변화율 (0.028 = 2.8%)
  highPrice24h: number;    // 24h 고가
  lowPrice24h: number;     // 24h 저가
  turnover24h: number;     // 24h 거래대금 (USDT)
  volume24h: number;       // 24h 거래량 (코인)
  fundingRate: number;     // 현재 펀딩비율
}

/** 바이비트 응답 객체를 Ticker로 변환한다 */
function parseTicker(raw: Record<string, string>): Ticker {
  return {
    symbol: raw.symbol,
    lastPrice: Number(raw.lastPrice),
    prevPrice24h: Number(raw.prevPrice24h),
    price24hPcnt: Number(raw.price24hPcnt),
    highPrice24h: Number(raw.highPrice24h),
    lowPrice24h: Number(raw.lowPrice24h),
    turnover24h: Number(raw.turnover24h),
    volume24h: Number(raw.volume24h),
    fundingRate: Number(raw.fundingRate),
  };
}

/** 바이비트 미결제약정(OI) 데이터 구조 */
export interface OpenInterest {
  timestamp: number;    // Unix ms
  openInterest: number; // 미결제약정 (코인 기준)
}

/**
 * 바이비트에서 미결제약정(OI) 히스토리를 가져온다
 * - intervalTime: '15min' | '1h' | '4h' | '1d'
 */
export async function fetchOpenInterest(
  symbol: string,
  intervalTime: string,
  limit: number = 200
): Promise<OpenInterest[]> {
  return withRetry(async () => {
    const url = `${BYBIT_API_BASE}/v5/market/open-interest`;
    const res = await axios.get(url, {
      params: { category: 'linear', symbol, intervalTime, limit },
    });

    if (res.data.retCode !== 0) {
      throw new Error(`[Fetcher] OI 조회 실패 (${symbol}): ${res.data.retMsg}`);
    }

    // 바이비트는 최신이 index 0인 배열로 반환
    return (res.data.result.list as Array<{ openInterest: string; timestamp: string }>)
      .map(item => ({
        timestamp: Number(item.timestamp),
        openInterest: Number(item.openInterest),
      }))
      .reverse(); // 오름차순으로 변환
  });
}

/** 바이비트 펀딩비율 히스토리 데이터 구조 */
export interface FundingRate {
  timestamp: number;   // 펀딩 지급 시각 (Unix ms)
  fundingRate: number; // 펀딩비율 (0.0001 = 0.01%)
}

/**
 * 바이비트에서 펀딩비율 히스토리를 가져온다
 * - 8시간마다 지급되므로 하루 3번 기록됨
 */
export async function fetchFundingHistory(
  symbol: string,
  limit: number = 200
): Promise<FundingRate[]> {
  return withRetry(async () => {
    const url = `${BYBIT_API_BASE}/v5/market/funding/history`;
    const res = await axios.get(url, {
      params: { category: 'linear', symbol, limit },
    });

    if (res.data.retCode !== 0) {
      throw new Error(`[Fetcher] 펀딩비율 조회 실패 (${symbol}): ${res.data.retMsg}`);
    }

    return (res.data.result.list as Array<{ fundingRate: string; fundingRateTimestamp: string }>)
      .map(item => ({
        timestamp: Number(item.fundingRateTimestamp),
        fundingRate: Number(item.fundingRate),
      }))
      .reverse(); // 오름차순으로 변환
  });
}

/** 바이비트 선물 티커(현재가/거래량 등)를 가져온다 */
export async function fetchTicker(symbol: string): Promise<Ticker> {
  return withRetry(async () => {
    const url = `${BYBIT_API_BASE}/v5/market/tickers`;
    const res = await axios.get(url, {
      params: { category: 'linear', symbol },
    });

    if (res.data.retCode !== 0) {
      throw new Error(`[Fetcher] 티커 조회 실패 (${symbol}): ${res.data.retMsg}`);
    }

    return parseTicker(res.data.result.list[0] as Record<string, string>);
  });
}
