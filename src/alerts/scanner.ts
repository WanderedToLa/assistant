import { fetchCandles } from '../fetcher';
import { calcVolumeRatio, isVolumeSpike } from '../analyzer';
import { sendMessage } from './telegram';
import { config } from '../config';

/** interval 숫자를 표시용 레이블로 변환한다 */
function toLabel(interval: string): string {
  if (interval === '5')  return '5분';
  if (interval === '15') return '15분';
  if (interval === '30') return '30분';
  return `${interval}분`;
}

/** 단일 심볼의 거래량 급등 여부를 체크하고 포맷된 문자열을 반환한다 (신호 없으면 null) */
async function scanSymbol(symbol: string, interval: string): Promise<string | null> {
  // 22개 조회: index 0 진행중, index 1 타겟(최근 마감), index 2~21 베이스라인(20개)
  const candles = await fetchCandles(symbol, interval, 22);
  if (candles.length < 3) return null;

  const target   = candles[1];
  const baseline = candles.slice(2);

  // 거래량 급등: 배율 조건 AND 절대 거래량(코인) 조건 둘 다 충족해야 함
  const volumeRatio    = calcVolumeRatio(target, baseline);
  const hasVolumeSpike =
    isVolumeSpike(volumeRatio, config.scanner.volumeSpikeThreshold) &&
    target.volume >= config.scanner.minVolumeCoins;

  if (!hasVolumeSpike) return null;

  const name       = symbol.replace('USDT', '');
  const changeRate = ((target.close - target.open) / target.open) * 100;
  const sign       = changeRate >= 0 ? '+' : '';
  const dirArrow   = changeRate >= 0 ? '▲' : '▼';

  const lines: string[] = [
    `<b>${name}</b>  [거래량 급등]  ${dirArrow} ${sign}${changeRate.toFixed(2)}%`,
    `  마감가 $${target.close.toLocaleString()}`,
    `  거래량 <b>${target.volume.toLocaleString()} BTC</b>  (평균 대비 ${volumeRatio.toFixed(1)}배)`,
  ];

  console.log(`[Scanner] 거래량 급등 → ${symbol} | ${target.volume.toLocaleString()} BTC (${volumeRatio.toFixed(1)}배)`);
  return lines.join('\n');
}

/** 감시 심볼 전체를 스캔하고 거래량 급등 신호가 있는 것만 하나의 메시지로 합쳐 전송한다 */
export async function runScanAll(interval: string): Promise<void> {
  const label   = toLabel(interval);
  const symbols = config.scanner.volumeSymbols;
  console.log(`[Scanner] ${label} 거래량 스캔 시작... (${symbols.join(', ')})`);

  const rows: string[] = [];

  for (const symbol of symbols) {
    try {
      const row = await scanSymbol(symbol, interval);
      if (row) rows.push(row);
    } catch (err) {
      console.error(`[Scanner] ${symbol} 스캔 실패:`, err);
    }
  }

  // 신호가 하나도 없으면 메시지 생략
  if (rows.length === 0) return;

  const msg = [
    `<b>[${label} 거래량 급등]</b>`,
    '',
    rows.join('\n\n'),
    '',
    `🕐 ${new Date().toLocaleTimeString('ko-KR')}`,
  ].join('\n');

  await sendMessage(msg);
}
