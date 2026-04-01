import axios from 'axios';

/** 바이비트 퍼블릭 API 베이스 URL */
const BYBIT_API_BASE = 'https://api.bybit.com';

/** 바이비트 캔들(Kline) 데이터 구조 */
export interface Candle {
  openTime: number; // 캔들 시작 시각 (Unix ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;   // 코인 기준 거래량
  turnover: number; // USDT 기준 거래대금
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
  const url = `${BYBIT_API_BASE}/v5/market/kline`;
  const res = await axios.get(url, {
    params: { category: 'linear', symbol, interval, limit },
  });

  if (res.data.retCode !== 0) {
    throw new Error(`[Fetcher] 캔들 조회 실패 (${symbol}): ${res.data.retMsg}`);
  }

  // 바이비트는 최신이 index 0인 배열로 반환
  return (res.data.result.list as string[][]).map(parseCandle);
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

/** 바이비트 선물 티커(현재가/거래량 등)를 가져온다 */
export async function fetchTicker(symbol: string): Promise<Ticker> {
  const url = `${BYBIT_API_BASE}/v5/market/tickers`;
  const res = await axios.get(url, {
    params: { category: 'linear', symbol },
  });

  if (res.data.retCode !== 0) {
    throw new Error(`[Fetcher] 티커 조회 실패 (${symbol}): ${res.data.retMsg}`);
  }

  return parseTicker(res.data.result.list[0] as Record<string, string>);
}
