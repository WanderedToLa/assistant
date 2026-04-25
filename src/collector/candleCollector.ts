import * as fs from 'fs';
import * as path from 'path';
import { fetchCandles, Candle } from '../fetcher';
import { config } from '../config';

/** 캔들 인터벌 코드 → 파일명 레이블 매핑 */
const INTERVAL_LABEL: Record<string, string> = {
  '15':  '15m',
  '60':  '1H',
  '240': '4H',
  'D':   '1D',
};

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
 * - 오름차순 정렬 (오래된 것이 앞)
 */
function mergeCandles(existing: Candle[], incoming: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of existing) map.set(c.openTime, c);
  for (const c of incoming) map.set(c.openTime, c);
  return Array.from(map.values()).sort((a, b) => a.openTime - b.openTime);
}

/** 심볼 + 인터벌의 캔들 데이터를 수집해 JSON에 저장한다 */
export async function collectCandles(symbol: string, interval: string): Promise<void> {
  const fp = resolveFilePath(symbol, interval);
  const label = INTERVAL_LABEL[interval] ?? interval;

  // 저장 디렉토리 없으면 생성
  fs.mkdirSync(path.dirname(fp), { recursive: true });

  // 바이비트에서 최신 캔들 가져오기
  // index 0 = 현재 진행 중인 봉(미완성) → 제외하고 마감된 봉만 사용
  const raw = await fetchCandles(symbol, interval, config.collector.fetchLimit + 1);
  const incoming = raw.slice(1);

  const existing = loadExisting(fp);
  const merged = mergeCandles(existing, incoming);

  fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`[CandleCollector] ${symbol} ${label} — 총 ${merged.length}개 저장 (신규 수집 ${incoming.length}개)`);
}

/** 설정된 모든 심볼 + 인터벌 조합의 캔들을 순서대로 수집한다 */
export async function collectAllCandles(): Promise<void> {
  const { symbols, intervals } = config.collector;
  for (const symbol of symbols) {
    for (const interval of intervals) {
      await collectCandles(symbol, interval);
    }
  }
}
