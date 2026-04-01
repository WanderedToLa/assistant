import { fetchTicker, Ticker } from '../fetcher';
import { sendMessage } from './telegram';
import { config } from '../config';

/** 구분선 (텔레그램 고정폭 폰트용) */
const DIVIDER = '─────────────────────';

/** 숫자를 억 단위로 포매팅한다 (예: 71.8억) */
function formatTurnover(usdt: number): string {
  const eok = usdt / 1_0000_0000;
  return eok.toFixed(1) + '억';
}

/** 가격을 읽기 좋게 포매팅한다 (소수점 자동 조정) */
function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1)    return price.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return price.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

/** 펀딩비율 강도를 이모지로 표시한다 (|rate| >= 0.01% 는 과열로 판단) */
function fundingEmoji(rate: number): string {
  const abs = Math.abs(rate * 100);
  if (abs >= 0.05) return rate >= 0 ? '🔥' : '🧊'; // 과열
  if (abs >= 0.01) return rate >= 0 ? '📈' : '📉'; // 주의
  return '➖';                                        // 중립
}

/** 심볼 하나의 요약 블록을 만든다 */
function buildTickerBlock(ticker: Ticker): string {
  const pct      = ticker.price24hPcnt * 100;
  const sign     = pct >= 0 ? '+' : '';
  const dirEmoji = pct >= 0 ? '🟢' : '🔴';
  const name     = ticker.symbol.replace('USDT', '');

  const funding     = (ticker.fundingRate * 100).toFixed(4);
  const fundingSign = ticker.fundingRate >= 0 ? '+' : '';

  return [
    // 1줄: 심볼명 / 현재가 / 등락률
    `${dirEmoji} <b>${name}</b>   $${formatPrice(ticker.lastPrice)}   <b>${sign}${pct.toFixed(2)}%</b>`,
    // 2줄: 고가 / 저가
    `     고 $${formatPrice(ticker.highPrice24h)}  ·  저 $${formatPrice(ticker.lowPrice24h)}`,
    // 3줄: 거래대금 / 펀딩비율
    `     거래대금 ${formatTurnover(ticker.turnover24h)}  ·  펀딩 ${fundingEmoji(ticker.fundingRate)} ${fundingSign}${funding}%`,
  ].join('\n');
}

/** 모든 감시 심볼의 티커를 가져와 시장 요약 메시지를 전송한다 */
export async function sendDailySummary(timeLabel: string = ''): Promise<void> {
  const now = new Date();

  // 날짜 표시 (KST)
  const dateStr = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(now);

  const headerLabel = timeLabel ? `  <code>${timeLabel}</code>` : '';
  console.log(`[Summary] 시장 요약 생성 중... (${timeLabel || '수동'})`);

  const blocks: string[] = [];

  for (const symbol of config.scanner.symbols) {
    try {
      const ticker = await fetchTicker(symbol);
      blocks.push(buildTickerBlock(ticker));
    } catch (err) {
      console.error(`[Summary] ${symbol} 티커 조회 실패:`, err);
      blocks.push(`⚠️ ${symbol} 데이터 조회 실패`);
    }
  }

  const msg = [
    `📊 <b>시장 요약</b>${headerLabel}`,
    `<i>${dateStr}</i>`,
    '',
    DIVIDER,
    blocks.join(`\n${DIVIDER}\n`),
    DIVIDER,
  ].join('\n');

  await sendMessage(msg);
  console.log(`[Summary] 전송 완료 (${timeLabel || '수동'})`);
}
