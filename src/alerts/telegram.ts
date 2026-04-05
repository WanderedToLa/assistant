import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';

/** 텔레그램 봇 인스턴스 — 메시지 전송 전용 (polling 비활성화) */
const bot = new TelegramBot(config.telegram.token, { polling: false });

/** 텔레그램 채팅방에 텍스트 메시지를 전송한다 */
export async function sendMessage(message: string): Promise<void> {
  try {
    await bot.sendMessage(config.telegram.chatId, message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[Telegram] 전송 실패:', err);
  }
}

