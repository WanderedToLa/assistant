import * as fs from 'fs';
import * as path from 'path';
import { fetchOpenInterest, fetchFundingHistory, OpenInterest, FundingRate } from '../fetcher';
import { config } from '../config';

/**
 * 캔들 인터벌 코드 → 바이비트 OI API intervalTime 매핑
 * OI API는 캔들 API와 파라미터 형식이 다름
 */
const OI_INTERVAL_MAP: Record<string, string> = {
  '15':  '15min',
  '60':  '1h',
  '240': '4h',
  'D':   '1d',
};

/** OI JSON 파일 저장 경로를 반환한다 */
function resolveOiPath(symbol: string, interval: string): string {
  const label = interval === 'D' ? '1D' : OI_INTERVAL_MAP[interval] ?? interval;
  const dir = path.resolve(config.collector.dataDir, 'oi');
  return path.join(dir, `${symbol}_${label}.json`);
}

/** 펀딩비율 JSON 파일 저장 경로를 반환한다 */
function resolveFundingPath(symbol: string): string {
  const dir = path.resolve(config.collector.dataDir, 'funding');
  return path.join(dir, `${symbol}.json`);
}

/** JSON 파일에서 기존 데이터를 읽는다 (파일 없으면 빈 배열 반환) */
function loadExisting<T>(fp: string): T[] {
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T[];
  } catch {
    console.warn(`[OiCollector] 파일 파싱 실패, 초기화: ${fp}`);
    return [];
  }
}

/**
 * timestamp 기준으로 기존 데이터와 신규 데이터를 병합한다
 * - 중복 제거 (신규 우선), 오름차순 정렬
 */
function mergeByTimestamp<T extends { timestamp: number }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<number, T>();
  for (const item of existing) map.set(item.timestamp, item);
  for (const item of incoming) map.set(item.timestamp, item);
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/** 심볼 + 인터벌의 OI 데이터를 수집해 JSON에 저장한다 */
export async function collectOI(symbol: string, interval: string): Promise<void> {
  const intervalTime = OI_INTERVAL_MAP[interval];
  // 1D OI는 바이비트가 지원하지 않으므로 스킵
  if (!intervalTime || interval === 'D') return;

  const fp = resolveOiPath(symbol, interval);
  fs.mkdirSync(path.dirname(fp), { recursive: true });

  const incoming = await fetchOpenInterest(symbol, intervalTime, config.collector.fetchLimit);
  const existing = loadExisting<OpenInterest>(fp);
  const merged = mergeByTimestamp(existing, incoming);

  fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`[OiCollector] ${symbol} OI ${intervalTime} — 총 ${merged.length}개 저장 (신규 ${incoming.length}개)`);
}

/** 심볼의 펀딩비율 히스토리를 수집해 JSON에 저장한다 */
export async function collectFunding(symbol: string): Promise<void> {
  const fp = resolveFundingPath(symbol);
  fs.mkdirSync(path.dirname(fp), { recursive: true });

  const incoming = await fetchFundingHistory(symbol, config.collector.fetchLimit);
  const existing = loadExisting<FundingRate>(fp);
  const merged = mergeByTimestamp(existing, incoming);

  fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`[OiCollector] ${symbol} 펀딩비율 — 총 ${merged.length}개 저장 (신규 ${incoming.length}개)`);
}

/** 설정된 모든 심볼의 OI + 펀딩비율을 순서대로 수집한다 */
export async function collectAllOI(): Promise<void> {
  const { symbols, intervals } = config.collector;
  for (const symbol of symbols) {
    for (const interval of intervals) {
      await collectOI(symbol, interval);
    }
    await collectFunding(symbol);
  }
}
