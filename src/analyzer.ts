import { Candle } from './fetcher';

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
