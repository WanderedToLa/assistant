import 'dotenv/config';

/** 환경변수를 한 곳에서 관리하는 설정 모듈 */

// 필수 환경변수 검증 — 없으면 즉시 종료
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`[Config] 필수 환경변수 누락: ${key}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  telegram: {
    token: requireEnv('TELEGRAM_TOKEN'),
    chatId: requireEnv('TELEGRAM_CHAT_ID'),
  },
  bybit: {
    apiKey: requireEnv('BYBIT_API_KEY'),
    // RSA 방식: Secret Key 없음 — 프라이빗 키 파일 경로로 서명
    privateKeyPath: requireEnv('BYBIT_PRIVATE_KEY_PATH'),
  },
  anthropic: {
    apiKey: requireEnv('ANTHROPIC_API_KEY'),
    // 비용 효율을 위해 Haiku 사용 (짧은 코멘트 생성에 충분)
    model: 'claude-haiku-4-5-20251001' as const,
  },
  scanner: {
    // 거래량 급등 감시 대상 심볼
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    // 거래량 급등 스캔 전용 심볼 (5분봉 BTC 집중)
    volumeSymbols: ['BTCUSDT'],
    // 평균 대비 몇 배 이상이면 거래량 급등으로 판단
    volumeSpikeThreshold: 2.0,
    // 베이스라인 평균 거래량 최소값 — 평균 자체가 이 미만이면 (시장 비활성) 스킵
    minAvgVolumeCoins: 300,
    // 전고점/전저점과 몇 % 이내에 들어오면 돌파 시도로 판단
    breakoutProximityPct: 0.5,
    // 5분 캔들 체크 주기 (ms)
    interval5m: 5 * 60 * 1000,
    // 15분 캔들 체크 주기 (ms)
    interval15m: 15 * 60 * 1000,
    // 30분 캔들 체크 주기 (ms)
    interval30m: 30 * 60 * 1000,
  },
  collector: {
    // 데이터 수집 대상 심볼
    symbols: ['BTCUSDT'],
    // 수집할 캔들 인터벌 (바이비트 API 형식: '15'=15분, '60'=1시간, '240'=4시간, 'D'=1일)
    intervals: ['15', '60', '240', 'D'] as string[],
    // 한 번에 가져올 캔들 수 (바이비트 최대 200개)
    fetchLimit: 200,
    // JSON 저장 루트 경로
    dataDir: 'data',
  },
} as const;
