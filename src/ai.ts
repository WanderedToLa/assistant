import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';

/** Claude 클라이언트 (싱글톤) */
const client = new Anthropic({ apiKey: config.anthropic.apiKey });

/** AI 코멘트 생성에 필요한 캔들 컨텍스트 */
export interface CandleContext {
  symbol: string;    // 예: 'BTCUSDT'
  interval: string;  // 예: '4H'
  open: number;
  high: number;
  low: number;
  close: number;
  changeRate: number;    // 등락률 (%)
  volumeRatio: number;   // 평균 대비 거래량 배율
}

/** 4H 캔들 마감 데이터를 기반으로 Claude AI 코멘트를 생성한다 */
export async function generateCandleComment(ctx: CandleContext): Promise<string> {
  const name = ctx.symbol.replace('USDT', '');
  const direction = ctx.changeRate >= 0 ? '양봉' : '음봉';
  const sign = ctx.changeRate >= 0 ? '+' : '';

  // 캔들 형태 분석을 위한 윗꼬리 / 아래꼬리 계산
  const bodyTop    = Math.max(ctx.open, ctx.close);
  const bodyBottom = Math.min(ctx.open, ctx.close);
  const upperWick  = ctx.high - bodyTop;
  const lowerWick  = bodyBottom - ctx.low;
  const bodySize   = Math.abs(ctx.close - ctx.open);

  const prompt = [
    `${name} ${ctx.interval} 캔들이 방금 마감했습니다.`,
    ``,
    `[캔들 데이터]`,
    `- 시가: ${ctx.open.toLocaleString()} / 종가: ${ctx.close.toLocaleString()}`,
    `- 고가: ${ctx.high.toLocaleString()} / 저가: ${ctx.low.toLocaleString()}`,
    `- 등락: ${sign}${ctx.changeRate.toFixed(2)}% (${direction})`,
    `- 몸통: ${bodySize.toFixed(2)} / 윗꼬리: ${upperWick.toFixed(2)} / 아래꼬리: ${lowerWick.toFixed(2)}`,
    `- 거래량: 평균 대비 ${ctx.volumeRatio.toFixed(1)}배`,
    ``,
    `트레이더 관점에서 2~3줄의 핵심 코멘트를 한국어로 작성하세요.`,
    `캔들 형태, 거래량 특이사항, 단기 방향성 힌트를 간결하게만 언급하세요.`,
    `불필요한 서론 없이 바로 본론만 작성하세요.`,
  ].join('\n');

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  // 텍스트 블록만 추출
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text.trim() ?? '코멘트를 생성하지 못했습니다.';
}
