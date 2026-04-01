import { sendMessage } from './telegram';

/** 복기 프롬프트 질문 목록 */
const JOURNAL_QUESTIONS = [
  '오늘 진입한 포지션이 있었나요? 근거는 무엇이었나요?',
  '계획대로 실행했나요? 충동적인 매매는 없었나요?',
  '오늘 시장에서 배운 점은 무엇인가요?',
  '내일 주목할 코인이나 레벨이 있나요?',
];

/** 매일 22:00 복기 프롬프트를 전송한다 (트랙 D) */
export async function sendJournalPrompt(): Promise<void> {
  const now = new Date().toLocaleDateString('ko-KR');
  const questionLines = JOURNAL_QUESTIONS
    .map((q, i) => `${i + 1}. ${q}`)
    .join('\n');

  const msg = [
    `<b>📝 오늘의 복기 — ${now}</b>`,
    '',
    questionLines,
    '',
    '오늘도 수고했습니다. 🙏',
  ].join('\n');

  await sendMessage(msg);
}

// TODO: node-cron으로 매일 22:00 KST 스케줄링 구현
