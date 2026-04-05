import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

/** Claude API 연결 및 응답 테스트 */
async function testClaudeAPI(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[테스트] ANTHROPIC_API_KEY 환경변수가 없습니다.');
    process.exit(1);
  }

  console.log('[테스트] Claude API 연결 시작...');

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: 'BTC이 지금 막 4H 양봉으로 마감했어. 한 줄로 코멘트해줘.',
      },
    ],
  });

  const text = response.content.find(b => b.type === 'text')?.text ?? '응답 없음';

  console.log('[테스트] 성공!');
  console.log(`[테스트] 모델: ${response.model}`);
  console.log(`[테스트] 응답: ${text}`);
  console.log(`[테스트] 사용 토큰 — 입력: ${response.usage.input_tokens}, 출력: ${response.usage.output_tokens}`);
}

testClaudeAPI().catch(err => {
  console.error('[테스트] 오류 발생:', err.message ?? err);
  process.exit(1);
});
