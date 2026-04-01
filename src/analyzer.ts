import { Candle } from './fetcher';

export type { Candle };

/** 가격 변화율(%)을 계산한다 */
export function calcChangeRate(prev: number, curr: number): number {
  // 변화율 = (현재 - 이전) / 이전 * 100
  return ((curr - prev) / prev) * 100;
}

/** 캔들 기준 가격 급등/급락 여부를 판단한다 */
export function isSpikeCandle(candle: Candle, thresholdPct: number): boolean {
  // 단일 캔들 등락폭이 임계값 이상이면 급등/급락으로 판단
  const bodyPct = Math.abs(calcChangeRate(candle.open, candle.close));
  return bodyPct >= thresholdPct;
}

/**
 * 기준 캔들의 거래량이 평균 대비 몇 배인지 계산한다
 * @param target  비교 대상 캔들 (보통 가장 최근 마감 캔들)
 * @param baseline 평균 계산에 사용할 캔들 배열 (target 제외)
 */
export function calcVolumeRatio(target: Candle, baseline: Candle[]): number {
  if (baseline.length === 0) return 0;

  // 기준 캔들들의 평균 거래량
  const avgVolume =
    baseline.reduce((sum, c) => sum + c.volume, 0) / baseline.length;

  if (avgVolume === 0) return 0;

  return target.volume / avgVolume;
}

/** 거래량 급등 여부를 판단한다 (ratio >= threshold) */
export function isVolumeSpike(ratio: number, threshold: number): boolean {
  return ratio >= threshold;
}

/** 전고점/전저점 돌파 시도 감지 결과 */
export interface BreakoutSignal {
  type: 'high' | 'low';
  level: number; // 전고점 또는 전저점 가격
}

/**
 * 현재 캔들이 baseline 캔들들의 전고점/전저점에 근접하거나 돌파하는지 판단한다
 * - proximityPct: 몇 % 이내에 들어오면 시도로 간주 (예: 0.5 → 0.5%)
 */
export function detectBreakout(
  target: Candle,
  baseline: Candle[],
  proximityPct: number
): BreakoutSignal | null {
  if (baseline.length === 0) return null;

  const prevHigh = Math.max(...baseline.map(c => c.high));
  const prevLow  = Math.min(...baseline.map(c => c.low));

  // 전고점 돌파 시도: 현재 고가가 전고점의 (1 - proximityPct%) 이상
  if (target.high >= prevHigh * (1 - proximityPct / 100)) {
    return { type: 'high', level: prevHigh };
  }

  // 전저점 돌파 시도: 현재 저가가 전저점의 (1 + proximityPct%) 이하
  if (target.low <= prevLow * (1 + proximityPct / 100)) {
    return { type: 'low', level: prevLow };
  }

  return null;
}
