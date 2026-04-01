import { fetchCandles } from '../fetcher';
import { calcVolumeRatio } from '../analyzer';
import { sendAlert } from './telegram';
import { config } from '../config';

/** interval 숫자를 표시용 레이블로 변환한다 (60 → '1H', 240 → '4H') */
function toLabel(intervalMin: number): string {
  if (intervalMin === 60)  return '1H';
  if (intervalMin === 240) return '4H';
  return `${intervalMin}m`;
}

/**
 * 단일 심볼의 캔들 마감 알림을 처리한다
 * - 1H: 가격/거래량 데이터만 전송
 * - 4H: 데이터 + Claude AI 코멘트 추가
 */
async function processCandleClose(symbol: string, intervalMin: number): Promise<void> {
  const label = toLabel(intervalMin);
  const name  = symbol.replace('USDT', '');

  // 최근 6개 캔들 조회 (index 0: 진행중, index 1: 최근 마감, index 2~5: 이전 4개)
  const candles = await fetchCandles(symbol, String(intervalMin), 6);
  if (candles.length < 3) return;

  const closed   = candles[1];       // 최근 마감 캔들
  const baseline = candles.slice(2); // 이전 4개 (거래량 평균 계산용)

  const changeRate   = ((closed.close - closed.open) / closed.open) * 100;
  const volumeRatio  = calcVolumeRatio(closed, baseline);
  const sign         = changeRate >= 0 ? '+' : '';
  const dirArrow     = changeRate >= 0 ? '▲' : '▼';

  console.log(`[Candle] ${name} ${label} 마감 — ${sign}${changeRate.toFixed(2)}%`);

  // 공통 데이터 블록
  const lines: string[] = [
    `마감가: $${closed.close.toLocaleString()}  ${dirArrow} <b>${sign}${changeRate.toFixed(2)}%</b>`,
    `고 $${closed.high.toLocaleString()}  ·  저 $${closed.low.toLocaleString()}`,
    `거래량: 평균 대비 ${volumeRatio.toFixed(1)}배`,
  ];

  // TODO: 크레딧 충전 후 4H 캔들에 AI 코멘트 재활성화 (generateCandleComment)

  await sendAlert(symbol, `${label} 캔들 마감`, lines.join('\n'));
}

/** 감시 심볼 전체를 순회하며 캔들 마감 알림을 처리한다 */
export async function checkCandleCloseAll(intervalMin: number): Promise<void> {
  const label = toLabel(intervalMin);
  console.log(`[Candle] ${label} 마감 처리 시작... (${config.scanner.symbols.join(', ')})`);

  for (const symbol of config.scanner.symbols) {
    try {
      await processCandleClose(symbol, intervalMin);
    } catch (err) {
      console.error(`[Candle] ${symbol} ${label} 처리 실패:`, err);
    }
  }
}
