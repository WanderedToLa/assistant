import 'dotenv/config';
import { runScanAll } from './alerts/scanner';

async function main() {
  // 15분 스캐너 테스트 (거래량 급등 + 돌파 시도 통합)
  console.log('스캐너 테스트 중...');
  await runScanAll('15');
  console.log('완료');
}

main();
