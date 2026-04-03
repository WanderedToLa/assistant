import { fetchCandles } from '../fetcher';
import { calcVolumeRatio } from '../analyzer';
import { sendMessage } from './telegram';
import { config } from '../config';

/** interval 숫자를 표시용 레이블로 변환한다 (60 → '1H', 240 → '4H') */
function toLabel(intervalMin: number): string {
  if (intervalMin === 60)  return '1H';
  if (intervalMin === 240) return '4H';
  return `${intervalMin}m`;
}

/** 단일 심볼 캔들 데이터를 조회해 포맷된 한 줄 문자열을 반환한다 (실패 시 null) */
async function processCandleClose(symbol: string, intervalMin: number): Promise<string | null> {
  const name = symbol.replace('USDT', '');

  // 최근 6개 캔들 조회 (index 0: 진행중, index 1: 최근 마감, index 2~5: 이전 4개)
  const candles = await fetchCandles(symbol, String(intervalMin), 6);
  if (candles.length < 3) return null;

  const closed   = candles[1];       // 최근 마감 캔들
  const baseline = candles.slice(2); // 이전 4개 (거래량 평균 계산용)

  const changeRate  = ((closed.close - closed.open) / closed.open) * 100;
  const volumeRatio = calcVolumeRatio(closed, baseline);
  const sign        = changeRate >= 0 ? '+' : '';
  const dirArrow    = changeRate >= 0 ? '▲' : '▼';

  console.log(`[Candle] ${name} 마감 — ${sign}${changeRate.toFixed(2)}%`);

  // 심볼 한 줄 요약: 이름 / 마감가 / 등락률 / 거래량 배율
  return (
    `<b>${name}</b>  ${dirArrow} ${sign}${changeRate.toFixed(2)}%\n` +
    `  마감가 $${closed.close.toLocaleString()}  ·  거래량 ${volumeRatio.toFixed(1)}배`
  );
}

/** 감시 심볼 전체를 순회하며 캔들 마감 결과를 하나의 메시지로 합쳐 전송한다 */
export async function checkCandleCloseAll(intervalMin: number): Promise<void> {
  const label = toLabel(intervalMin);
  console.log(`[Candle] ${label} 마감 처리 시작... (${config.scanner.symbols.join(', ')})`);

  const rows: string[] = [];

  for (const symbol of config.scanner.symbols) {
    try {
      const row = await processCandleClose(symbol, intervalMin);
      if (row) rows.push(row);
    } catch (err) {
      console.error(`[Candle] ${symbol} ${label} 처리 실패:`, err);
    }
  }

  if (rows.length === 0) return;

  // 모든 심볼 결과를 한 메시지로 합쳐서 전송
  const msg = [
    `<b>[${label} 캔들 마감]</b>`,
    '',
    rows.join('\n\n'),
    '',
    `🕐 ${new Date().toLocaleTimeString('ko-KR')}`,
  ].join('\n');

  // TODO: 크레딧 충전 후 4H 캔들에 AI 코멘트 재활성화 (generateCandleComment)

  await sendMessage(msg);
}
