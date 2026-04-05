import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';
import type { Ticker } from './fetcher';

/** Claude 클라이언트 (싱글톤) */
const client = new Anthropic({ apiKey: config.anthropic.apiKey });

/** 시장 요약 AI 코멘트 생성에 필요한 컨텍스트 */
export interface SummaryContext {
  tickers: Ticker[];   // 감시 심볼들의 티커 데이터
  timeLabel: string;   // 예: '오전 9시', '오후 6시'
}

/** 시장 요약 데이터를 기반으로 Claude AI 시황 코멘트를 생성한다 */
export async function generateSummaryComment(ctx: SummaryContext): Promise<string> {
  // 각 심볼의 핵심 지표를 한 줄로 정리
  const lines = ctx.tickers.map(t => {
    const name    = t.symbol.replace('USDT', '');
    const pct     = (t.price24hPcnt * 100).toFixed(2);
    const sign    = t.price24hPcnt >= 0 ? '+' : '';
    const funding = (t.fundingRate * 100).toFixed(4);
    const fSign   = t.fundingRate >= 0 ? '+' : '';
    return `${name}: $${t.lastPrice.toLocaleString()} (${sign}${pct}%), 펀딩 ${fSign}${funding}%`;
  });

  const prompt = [
    `${ctx.timeLabel} 코인 선물 시장 현황입니다.`,
    ``,
    ...lines,
    ``,
    `트레이더 관점에서 2~3줄의 핵심 시황 코멘트를 한국어로 작성하세요.`,
    `전체 시장 분위기, 주목할 만한 움직임, 단기 방향성 힌트를 간결하게 언급하세요.`,
    `불필요한 서론 없이 바로 본론만 작성하세요.`,
  ].join('\n');

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text.trim() ?? '코멘트를 생성하지 못했습니다.';
}
