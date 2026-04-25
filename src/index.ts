import './config'; // 환경변수 초기화 (가장 먼저 로드)
import { config } from './config';
import { sendMessage } from './alerts/telegram';
import { runScanAll } from './alerts/scanner';
import { checkCandleCloseAll } from './alerts/candle';
import { sendDailySummary } from './alerts/summary';
import { collectCandles } from './collector/candleCollector';
import { collectOI, collectFunding } from './collector/oiCollector';
import { collectTrades } from './collector/tradeCollector';

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

/**
 * 캔들 마감 시점마다 해당 인터벌의 캔들 + OI 데이터를 수집한다
 * - intervalMin: 15 | 60 | 240 | 1440
 * - bybitInterval: 바이비트 API 형식 ('15' | '60' | '240' | 'D')
 */
function scheduleCollect(intervalMin: number, bybitInterval: string): void {
  const label = bybitInterval === 'D' ? '1D' : `${intervalMin}분`;
  const intervalMs = intervalMin * MS_PER_MIN;
  const waitMs = msUntilNextCandle(intervalMin);
  console.log(`[Collector] ${label} 수집 — 다음 마감까지 ${Math.round(waitMs / 1000)}초 대기`);

  const collect = async () => {
    for (const symbol of config.collector.symbols) {
      await collectCandles(symbol, bybitInterval);
      await collectOI(symbol, bybitInterval);
    }
    // 1D 마감 시점에만 펀딩비율 수집 (하루 1회로 충분)
    if (bybitInterval === 'D') {
      for (const symbol of config.collector.symbols) {
        await collectFunding(symbol);
      }
    }
  };

  setTimeout(() => {
    collect();
    setInterval(collect, intervalMs);
  }, waitMs);
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

  // BTC 거래량 급등 스캔 (5분 캔들 마감마다)
  scheduleScan(5);

  // 캔들 + OI 실시간 수집 (각 인터벌 마감마다)
  scheduleCollect(15,   '15');  // 15분봉
  scheduleCollect(60,   '60');  // 1시간봉
  scheduleCollect(240,  '240'); // 4시간봉
  scheduleCollect(1440, 'D');   // 일봉 + 펀딩비율

  // 내 거래 데이터 수집 (하루 1회, 새벽 1시 KST)
  scheduleDailyAt(1, 0, () => collectTrades(), '거래 데이터 수집');

  // 캔들 마감 알림 (4H)
  scheduleCandleCheck(240);

  // 시장 요약 — 하루 5회 (KST 기준)
  const SUMMARY_TIMES: Array<{ h: number; m: number; label: string; macro?: boolean }> = [
    { h:  6, m: 0, label: '오전 6시'  },
    { h:  9, m: 0, label: '오전 9시',  macro: true }, // 매크로 블록 포함
    { h: 18, m: 0, label: '오후 6시',  macro: true }, // 매크로 블록 포함
    { h: 23, m: 0, label: '오후 11시' },
    { h:  3, m: 0, label: '오전 3시'  },
  ];

  for (const { h, m, label, macro } of SUMMARY_TIMES) {
    scheduleDailyAt(h, m, () => sendDailySummary(label, macro), `시장 요약 (${label})`);
  }

  console.log('[Bot] 스케줄러 등록 완료. 대기 중...');
}

main().catch((err) => {
  console.error('[Bot] 치명적 오류 발생:', err);
  process.exit(1);
});
