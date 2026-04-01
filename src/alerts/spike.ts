import { sendAlert } from './telegram';

/** 급등/급락 감지 임계값 (%) */
const SPIKE_THRESHOLD_PCT = 3;

/** 급등/급락 감지 시 알림을 전송한다 (트랙 B) */
export async function notifySpike(
  symbol: string,
  changeRate: number,
  currentPrice: number
): Promise<void> {
  if (Math.abs(changeRate) < SPIKE_THRESHOLD_PCT) return;

  const direction = changeRate > 0 ? '🚀 급등' : '🔻 급락';
  const detail = [
    `현재가: ${currentPrice.toLocaleString()} USDT`,
    `변화율: ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}%`,
  ].join('\n');

  await sendAlert(symbol, direction, detail);
}

// TODO: 실시간 가격 스트림과 연동하여 반복 감지 루프 구현
// TODO: 같은 심볼 반복 알림 방지 쿨다운 로직 추가
