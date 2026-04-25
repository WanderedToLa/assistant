import * as fs from 'fs';
import * as path from 'path';
import { privateGet } from './privateClient';
import { config } from '../config';

/** 저장할 거래 데이터 구조 */
export interface Trade {
  symbol: string;
  side: 'Buy' | 'Sell';     // Buy = 롱 진입, Sell = 숏 진입
  leverage: number;
  qty: number;               // 거래 수량 (코인)
  cumEntryValue: number;     // 진입 비중 (USDT)
  avgEntryPrice: number;     // 평균 진입가
  avgExitPrice: number;      // 평균 청산가
  closedPnl: number;         // 실현 손익 (USDT, 수수료 포함)
  createdTime: number;       // 포지션 진입 시각 (Unix ms)
  updatedTime: number;       // 포지션 청산 시각 (Unix ms)
}

/** 바이비트 closed-pnl 응답 타입 */
interface BybitClosedPnlItem {
  symbol: string;
  side: string;
  leverage: string;
  qty: string;
  cumEntryValue: string;
  avgEntryPrice: string;
  avgExitPrice: string;
  closedPnl: string;
  createdTime: string;
  updatedTime: string;
}

interface BybitClosedPnlResult {
  list: BybitClosedPnlItem[];
  nextPageCursor: string;
}

/** 바이비트 응답 항목을 Trade 구조로 변환한다 */
function parseTradeItem(item: BybitClosedPnlItem): Trade {
  return {
    symbol:        item.symbol,
    side:          item.side as 'Buy' | 'Sell',
    leverage:      Number(item.leverage),
    qty:           Number(item.qty),
    cumEntryValue: Number(item.cumEntryValue),
    avgEntryPrice: Number(item.avgEntryPrice),
    avgExitPrice:  Number(item.avgExitPrice),
    closedPnl:     Number(item.closedPnl),
    createdTime:   Number(item.createdTime),
    updatedTime:   Number(item.updatedTime),
  };
}

/** 거래 데이터 JSON 파일 경로를 반환한다 */
function resolveFilePath(): string {
  const dir = path.resolve(config.collector.dataDir, 'trades');
  return path.join(dir, 'closed_pnl.json');
}

/** JSON 파일에서 기존 거래 데이터를 읽는다 (파일 없으면 빈 배열 반환) */
function loadExisting(fp: string): Trade[] {
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8')) as Trade[];
  } catch {
    console.warn('[TradeCollector] 파일 파싱 실패, 초기화');
    return [];
  }
}

/**
 * createdTime 기준으로 기존 + 신규 데이터를 병합한다
 * - 중복 제거, 오름차순 정렬 (오래된 거래가 앞)
 */
function mergeTrades(existing: Trade[], incoming: Trade[]): Trade[] {
  const map = new Map<number, Trade>();
  for (const t of existing) map.set(t.createdTime, t);
  for (const t of incoming) map.set(t.createdTime, t);
  return Array.from(map.values()).sort((a, b) => a.createdTime - b.createdTime);
}

/**
 * 바이비트에서 청산된 포지션 목록을 페이지 단위로 모두 가져온다
 * - 커서 기반 페이지네이션으로 전체 히스토리 수집
 */
async function fetchAllClosedPnl(): Promise<Trade[]> {
  const all: Trade[] = [];
  let cursor = '';

  // 최대 10페이지(200건 × 10 = 2000건)까지 수집
  for (let page = 0; page < 10; page++) {
    const params: Record<string, string | number> = {
      category: 'linear',
      limit: 200,
    };
    if (cursor) params.cursor = cursor;

    const result = await privateGet<BybitClosedPnlResult>(
      '/v5/position/closed-pnl',
      params
    );

    const items = result.list.map(parseTradeItem);
    all.push(...items);

    // 다음 페이지 없으면 종료
    if (!result.nextPageCursor) break;
    cursor = result.nextPageCursor;
  }

  return all;
}

/** 청산된 포지션 전체를 수집해 JSON에 저장한다 */
export async function collectTrades(): Promise<void> {
  const fp = resolveFilePath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });

  console.log('[TradeCollector] 거래 데이터 수집 중...');
  const incoming = await fetchAllClosedPnl();

  const existing = loadExisting(fp);
  const merged = mergeTrades(existing, incoming);

  fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`[TradeCollector] 총 ${merged.length}건 저장 (수집 ${incoming.length}건)`);
}
