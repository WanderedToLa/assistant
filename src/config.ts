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
    // 바이비트 API (Phase 2 이후 사용)
    apiKey: process.env.BYBIT_API_KEY ?? '',
    apiSecret: process.env.BYBIT_API_SECRET ?? '',
  },
  anthropic: {
    apiKey: requireEnv('ANTHROPIC_API_KEY'),
    // 비용 효율을 위해 Haiku 사용 (짧은 코멘트 생성에 충분)
    model: 'claude-haiku-4-5' as const,
  },
  scanner: {
    // 거래량 급등 감시 대상 심볼
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    // 거래량 급등 스캔 전용 심볼 (5분봉 BTC 집중)
    volumeSymbols: ['BTCUSDT'],
    // 평균 대비 몇 배 이상이면 거래량 급등으로 판단
    volumeSpikeThreshold: 2.0,
    // 절대 거래량 최소값 (코인 기준) — 이 미만이면 배율이 높아도 급등으로 보지 않음
    minVolumeCoins: 2000,
    // 전고점/전저점과 몇 % 이내에 들어오면 돌파 시도로 판단
    breakoutProximityPct: 0.5,
    // 5분 캔들 체크 주기 (ms)
    interval5m: 5 * 60 * 1000,
    // 15분 캔들 체크 주기 (ms)
    interval15m: 15 * 60 * 1000,
    // 30분 캔들 체크 주기 (ms)
    interval30m: 30 * 60 * 1000,
  },
} as const;
