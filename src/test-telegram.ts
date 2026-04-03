import 'dotenv/config';
import { checkCandleCloseAll } from './alerts/candle';
import { runScanAll } from './alerts/scanner';
import { sendDailySummary } from './alerts/summary';

async function main() {
  console.log('=== 텔레그램 알림 테스트 ===');

  console.log('[1] 4H 캔들 마감 알림 테스트...');
  await checkCandleCloseAll(240);

  console.log('[2] 5분 거래량 급등 스캔 테스트...');
  await runScanAll('5');

  console.log('[3] 오후 6시 시장 요약 (매크로 포함) 테스트...');
  await sendDailySummary('오후 6시', true);

  console.log('완료');
}

main();
