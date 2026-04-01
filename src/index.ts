import './config'; // 환경변수 초기화 (가장 먼저 로드)
import { config } from './config';
import { sendMessage } from './alerts/telegram';
import { runScanAll } from './alerts/scanner';
import { checkCandleCloseAll } from './alerts/candle';
import { sendDailySummary } from './alerts/summary';

const MS_PER_MIN = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MIN;

/** 다음 캔들 마감까지 남은 시간(ms)을 계산한다 */
function msUntilNextCandle(intervalMin: number): number {
  const intervalMs = intervalMin * MS_PER_MIN;
  return intervalMs - (Date.now() % intervalMs);
}

/**
 * 다음 KST 지정 시각(시:분)까지 남은 시간(ms)을 계산한다
 * KST = UTC+9 이므로 UTC 기준으로 변환해서 계산
 */
function msUntilNextKST(hourKST: number, minuteKST: number = 0): number {
  const now = new Date();
  // 오늘 KST 목표 시각을 UTC Date로 표현
  const target = new Date(now);
  target.setUTCHours(hourKST - 9, minuteKST, 0, 0); // KST-9 = UTC

  // 이미 지났으면 다음 날로
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target.getTime() - now.getTime();
}

/** 캔들 마감 시점에 맞춰 스캐너(거래량 급등 + 돌파 시도) 루프를 시작한다 */
function scheduleScan(intervalMin: number): void {
  const label = `${intervalMin}분`;
  const waitMs = msUntilNextCandle(intervalMin);
  console.log(`[Scheduler] ${label} 캔들 스캔 — 다음 마감까지 ${Math.round(waitMs / 1000)}초 대기`);

  setTimeout(() => {
    runScanAll(String(intervalMin));
    setInterval(() => runScanAll(String(intervalMin)), intervalMin * MS_PER_MIN);
  }, waitMs);
}

/** 캔들 마감 시점에 맞춰 캔들 마감 알림 루프를 시작한다 */
function scheduleCandleCheck(intervalMin: number): void {
  const label = intervalMin === 60 ? '1H' : '4H';
  const waitMs = msUntilNextCandle(intervalMin);
  console.log(`[Scheduler] ${label} 캔들 마감 알림 — 다음 마감까지 ${Math.round(waitMs / 1000)}초 대기`);

  setTimeout(() => {
    checkCandleCloseAll(intervalMin);
    setInterval(() => checkCandleCloseAll(intervalMin), intervalMin * MS_PER_MIN);
  }, waitMs);
}

/** 매일 지정한 KST 시각에 함수를 실행하는 일간 스케줄러 */
function scheduleDailyAt(hourKST: number, minuteKST: number, task: () => void, label: string): void {
  const waitMs = msUntilNextKST(hourKST, minuteKST);
  const waitMin = Math.round(waitMs / MS_PER_MIN);
  console.log(`[Scheduler] ${label} — 다음 실행까지 ${waitMin}분 대기 (매일 ${hourKST}:${String(minuteKST).padStart(2, '0')} KST)`);

  setTimeout(() => {
    task();
    setInterval(task, MS_PER_DAY);
  }, waitMs);
}

/** 봇의 메인 진입점 — 초기화 및 루프 시작 */
async function main(): Promise<void> {
  console.log('[Bot] 트레이딩 봇 시작...');

  await sendMessage('트레이딩 봇이 시작되었습니다. ✅\n감시 심볼: ' + config.scanner.symbols.join(', '));

  // 거래량 급등 + 돌파 시도 통합 스캔 (15분 / 30분 캔들 마감마다)
  scheduleScan(15);
  scheduleScan(30);

  // 캔들 마감 알림 (1H: 데이터만 / 4H: 데이터 + AI 코멘트)
  scheduleCandleCheck(60);
  scheduleCandleCheck(240);

  // 시장 요약 — 하루 5회 (KST 기준)
  const SUMMARY_TIMES: Array<{ h: number; m: number; label: string }> = [
    { h:  6, m: 0, label: '오전 6시'  },
    { h:  9, m: 0, label: '오전 9시'  },
    { h: 18, m: 0, label: '오후 6시'  },
    { h: 23, m: 0, label: '오후 11시' },
    { h:  3, m: 0, label: '오전 3시'  },
  ];

  for (const { h, m, label } of SUMMARY_TIMES) {
    scheduleDailyAt(h, m, () => sendDailySummary(label), `시장 요약 (${label})`);
  }

  console.log('[Bot] 스케줄러 등록 완료. 대기 중...');
}

main().catch((err) => {
  console.error('[Bot] 치명적 오류 발생:', err);
  process.exit(1);
});
