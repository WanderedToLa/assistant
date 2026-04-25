import '../config'; // 환경변수 초기화
import { collectAllCandles } from './candleCollector';
import { collectTrades } from './tradeCollector';

/**
 * 과거 데이터 초기 백필용 스크립트
 * 봇 최초 실행 전 한 번만 사용 — 이후에는 index.ts의 scheduleCollect가 자동 수집
 * 실행 방법: npm run collect
 */
async function run(): Promise<void> {
  console.log('[Collector] 초기 데이터 백필 시작...\n');

  console.log('--- 캔들 수집 (15m / 1H / 4H / 1D) ---');
  await collectAllCandles();

  console.log('\n--- 거래 데이터 수집 ---');
  await collectTrades();

  console.log('\n[Collector] 백필 완료. 이후 수집은 봇 실행 시 자동으로 진행됩니다.');
}

run().catch(err => {
  console.error('[Collector] 오류 발생:', err);
  process.exit(1);
});
