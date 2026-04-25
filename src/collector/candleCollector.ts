import * as fs from 'fs';
import * as path from 'path';
import { fetchCandles, fetchTicker, fetchOpenInterest, Candle } from '../fetcher';
import { config } from '../config';

/** 캔들 인터벌 코드 → 파일명 레이블 매핑 */
const INTERVAL_LABEL: Record<string, string> = {
  '15':  '15m',
  '60':  '1H',
  '240': '4H',
  'D':   '1D',
};

/** 정상 운영 시 최소 수집량 (gap이 이보다 작으면 이 값을 사용) */
const INCREMENTAL_MIN = 3;

/** 펀딩비율 + OI 데이터를 캔들에 첨부할 심볼 */
const ENRICH_SYMBOL = 'BTCUSDT';

/** 인터벌 문자열을 ms로 변환한다 */
function intervalToMs(interval: string): number {
  if (interval === 'D') return 24 * 60 * 60 * 1000;
  return Number(interval) * 60 * 1000;
}

/**
 * 마지막 저장 openTime 기준으로 빠진 봉 수를 계산해 fetch할 limit을 반환한다
 * 예) 봇이 4시간 꺼져있었고 15분봉이면 → 빠진 봉 16개 → limit 17 반환
 */
function calcGapLimit(lastOpenTime: number, interval: string): number {
  const intervalMs = intervalToMs(interval);
  const missed = Math.max(0, Math.floor((Date.now() - lastOpenTime) / intervalMs) - 1);
  return Math.max(INCREMENTAL_MIN, missed + 1);
}

/** JSON 파일 저장 경로를 반환한다 */
function resolveFilePath(symbol: string, interval: string): string {
  const label = INTERVAL_LABEL[interval] ?? interval;
  const dir = path.resolve(config.collector.dataDir, 'candles');
  return path.join(dir, `${symbol}_${label}.json`);
}

/** JSON 파일에서 기존 캔들 배열을 읽는다 (파일 없으면 빈 배열 반환) */
function loadExisting(fp: string): Candle[] {
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8')) as Candle[];
  } catch {
    console.warn(`[CandleCollector] 파일 파싱 실패, 초기화: ${fp}`);
    return [];
  }
}

/**
 * 기존 데이터와 신규 데이터를 병합한다
 * - openTime 기준 중복 제거 (신규 우선)
 * - fundingRate / openInterest는 기존 값이 있으면 보존 (gap 백필 시 덮어쓰지 않음)
 * - 오름차순 정렬 (오래된 것이 앞)
 */
function mergeCandles(existing: Candle[], incoming: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of existing) map.set(c.openTime, c);
  for (const c of incoming) {
    const prev = map.get(c.openTime);
    map.set(c.openTime, {
      ...prev,
      ...c,
      fundingRate:  c.fundingRate  ?? prev?.fundingRate,
      openInterest: c.openInterest ?? prev?.openInterest,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.openTime - b.openTime);
}

/**
 * BTCUSDT 4H 캔들에 마감 시점 예측 펀딩비율을 첨부한다
 * - ticker API의 fundingRate = 현재 예측 펀딩비율 (Option A)
 * - 가장 최근에 닫힌 봉(incoming[0])에만 첨부
 */
async function enrichFundingRate(incoming: Candle[]): Promise<void> {
  if (incoming.length === 0) return;
  try {
    const ticker = await fetchTicker(ENRICH_SYMBOL);
    incoming[0].fundingRate = ticker.fundingRate;
  } catch (err) {
    console.warn('[CandleCollector] 펀딩비율 첨부 실패:', err);
  }
}

/**
 * BTCUSDT 1D 캔들에 마감 시점 미결제약정(OI)을 첨부한다
 * - 가장 최근에 닫힌 봉(incoming[0])에만 첨부
 */
async function enrichOpenInterest(incoming: Candle[]): Promise<void> {
  if (incoming.length === 0) return;
  try {
    const oiData = await fetchOpenInterest(ENRICH_SYMBOL, '1d', 1);
    if (oiData.length > 0) incoming[0].openInterest = oiData[0].openInterest;
  } catch (err) {
    console.warn('[CandleCollector] OI 첨부 실패:', err);
  }
}

/** 심볼 + 인터벌의 캔들 데이터를 수집해 JSON에 저장한다 */
export async function collectCandles(symbol: string, interval: string, backfillLimit: number = config.collector.fetchLimit): Promise<void> {
  const fp = resolveFilePath(symbol, interval);
  const label = INTERVAL_LABEL[interval] ?? interval;

  fs.mkdirSync(path.dirname(fp), { recursive: true });

  const existing = loadExisting(fp);

  const limit = existing.length > 0
    ? calcGapLimit(existing[existing.length - 1].openTime, interval)
    : backfillLimit;

  // index 0 = 현재 진행 중인 봉(미완성) → 제외하고 마감된 봉만 사용
  const raw = await fetchCandles(symbol, interval, limit + 1);
  const incoming = raw.slice(1);

  // BTCUSDT 4H: 마감 시점 예측 펀딩비율 첨부
  if (symbol === ENRICH_SYMBOL && interval === '240') {
    await enrichFundingRate(incoming);
  }

  // BTCUSDT 1D: 마감 시점 OI 첨부
  if (symbol === ENRICH_SYMBOL && interval === 'D') {
    await enrichOpenInterest(incoming);
  }

  const merged = mergeCandles(existing, incoming);
  fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`[CandleCollector] ${symbol} ${label} — 총 ${merged.length}개 저장 (신규 수집 ${incoming.length}개)`);
}

/** 설정된 모든 심볼 + 인터벌 조합의 캔들을 순서대로 수집한다 */
export async function collectAllCandles(limit: number = config.collector.fetchLimit): Promise<void> {
  const { symbols, intervals } = config.collector;
  for (const symbol of symbols) {
    for (const interval of intervals) {
      await collectCandles(symbol, interval, limit);
    }
  }
}
