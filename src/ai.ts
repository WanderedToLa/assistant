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
  `당신은 코인 선물 트레이더의 매매 보조 AI입니다.`,
  `${ctx.timeLabel} 시장 데이터를 분석하고`,
  `트레이더가 지금 당장 판단해야 할 핵심만 요약하세요.`,
  ``,
  ...lines,
  ``,
  `아래 형식을 정확히 따르세요:`,
  `① 시장 구조: (추세 지속 or 전환 가능성 한 줄)`,
  `② 핵심 구간: BTC $X 지지 / $X 저항`,
  `③ 행동 지침: 관망 / 롱 대기 / 숏 대기 + 이유 한 줄`,
  ``,
  `주의사항:`,
  `- 마크다운 사용 금지 (**, ##, 테이블 전부 금지)`,
  `- 이모지 사용 금지`,
  `- 3줄 초과 금지`,
  `- 근거 없는 전망 금지`,
].join('\n');

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text.trim() ?? '코멘트를 생성하지 못했습니다.';
}
