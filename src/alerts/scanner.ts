import { fetchCandles } from '../fetcher';
import { calcVolumeRatio, isVolumeSpike, detectBreakout } from '../analyzer';
import { sendAlert } from './telegram';
import { config } from '../config';

/** interval 숫자를 표시용 레이블로 변환한다 */
function toLabel(interval: string): string {
  if (interval === '15') return '15분';
  if (interval === '30') return '30분';
  return `${interval}분`;
}

/**
 * 단일 심볼에 대해 거래량 급등(B) + 전고점/전저점 돌파 시도(D)를 동시에 체크한다
 * - 둘 중 하나라도 감지되면 알림 1개 전송
 * - 돌파 시도가 있을 때만 해당 줄이 메시지에 추가됨
 */
async function scanSymbol(symbol: string, interval: string): Promise<void> {
  // 22개 조회: index 0 진행중, index 1 타겟(최근 마감), index 2~21 베이스라인(20개)
  const candles = await fetchCandles(symbol, interval, 22);
  if (candles.length < 3) return;

  const target   = candles[1];
  const baseline = candles.slice(2);

  // 두 조건 독립 체크
  const volumeRatio    = calcVolumeRatio(target, baseline);
  const hasVolumeSpike = isVolumeSpike(volumeRatio, config.scanner.volumeSpikeThreshold);
  const breakout       = detectBreakout(target, baseline, config.scanner.breakoutProximityPct);
  const hasBreakout    = breakout !== null;

  // 둘 다 없으면 조용히 통과
  if (!hasVolumeSpike && !hasBreakout) return;

  const label      = toLabel(interval);
  const changeRate = ((target.close - target.open) / target.open) * 100;
  const sign       = changeRate >= 0 ? '+' : '';
  const dirArrow   = changeRate >= 0 ? '▲' : '▼';

  // 감지 조합에 따라 알림 제목 결정
  let title: string;
  if (hasVolumeSpike && hasBreakout) title = `${label} 복합 신호`;
  else if (hasVolumeSpike)           title = `${label} 거래량 급등`;
  else                               title = `${label} 돌파 시도`;

  // 기본 줄: 마감가 + 등락률 (항상 포함)
  const lines: string[] = [
    `마감가: $${target.close.toLocaleString()}  ${dirArrow} <b>${sign}${changeRate.toFixed(2)}%</b>`,
  ];

  // 거래량 급등 감지 시에만 추가
  if (hasVolumeSpike) {
    lines.push(`거래량: 평균 대비 <b>${volumeRatio.toFixed(1)}배</b>`);
  }

  // 돌파 시도 감지 시에만 추가 (추가 메시지)
  if (hasBreakout && breakout) {
    const emoji = breakout.type === 'high' ? '📈' : '📉';
    const lvlLabel = breakout.type === 'high' ? '전고점' : '전저점';
    lines.push(`${emoji} ${lvlLabel} $${breakout.level.toLocaleString()} 돌파 시도 중`);
  }

  await sendAlert(symbol, title, lines.join('\n'));
  console.log(`[Scanner] 신호 → ${symbol} ${label} | 거래량:${hasVolumeSpike} 돌파:${hasBreakout}`);
}

/** 감시 심볼 전체를 스캔한다 (B+D 통합) */
export async function runScanAll(interval: string): Promise<void> {
  const label = toLabel(interval);
  console.log(`[Scanner] ${label} 스캔 시작... (${config.scanner.symbols.join(', ')})`);

  for (const symbol of config.scanner.symbols) {
    try {
      await scanSymbol(symbol, interval);
    } catch (err) {
      console.error(`[Scanner] ${symbol} 스캔 실패:`, err);
    }
  }
}
