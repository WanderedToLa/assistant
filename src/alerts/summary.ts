import { fetchTicker, Ticker } from '../fetcher';
import { sendMessage } from './telegram';
import { buildMacroBlock } from './macro';
import { generateSummaryComment } from '../ai';
import { config } from '../config';

/** 구분선 (텔레그램 고정폭 폰트용) */
const DIVIDER = '─────────────────────';

/** 거래대금을 B(billion) 단위로 포매팅한다 (예: 1,780,000,000 → 1.78B) */
function formatTurnover(usdt: number): string {
  return (usdt / 1_000_000_000).toFixed(2) + 'B';
}

/** 가격을 읽기 좋게 포매팅한다 (소수점 자동 조정, $ 없음) */
function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1)    return price.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return price.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

/** 심볼 하나의 요약 블록을 만든다 */
function buildTickerBlock(ticker: Ticker): string {
  const pct    = ticker.price24hPcnt * 100;
  const arrow  = pct >= 0 ? '▲' : '▼';
  const name   = ticker.symbol.replace('USDT', '');
  const funding = (ticker.fundingRate * 100).toFixed(3); // 예: -0.010

  return [
    // 1줄: 심볼명 / 현재가 / 등락률 (방향은 ▲▼로, 절댓값 표시)
    `<b>${name}</b>  ${formatPrice(ticker.lastPrice)} ${arrow} ${Math.abs(pct).toFixed(2)}%`,
    // 2줄: 고가(H) / 저가(L) / 펀딩비율 / 거래대금
    `     H ${formatPrice(ticker.highPrice24h)}  L ${formatPrice(ticker.lowPrice24h)}  |  펀딩 ${funding}%  |  ${formatTurnover(ticker.turnover24h)}`,
  ].join('\n');
}

/**
 * 모든 감시 심볼의 티커를 가져와 시장 요약 메시지를 전송한다
 * @param includeMacro true이면 공포탐욕지수/BTC 도미넌스 블록을 추가한다
 */
export async function sendDailySummary(timeLabel: string = '', includeMacro: boolean = false): Promise<void> {
  const now = new Date();

  // 날짜 표시 (KST)
  const dateStr = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(now);

  const headerLabel = timeLabel ? `  <code>${timeLabel}</code>` : '';
  console.log(`[Summary] 시장 요약 생성 중... (${timeLabel || '수동'})`);

  const blocks: string[] = [];
  const tickers: Ticker[] = [];

  for (const symbol of config.scanner.symbols) {
    try {
      const ticker = await fetchTicker(symbol);
      tickers.push(ticker);
      blocks.push(buildTickerBlock(ticker));
    } catch (err) {
      console.error(`[Summary] ${symbol} 티커 조회 실패:`, err);
      blocks.push(`⚠️ ${symbol} 데이터 조회 실패`);
    }
  }

  // AI 시황 코멘트 생성
  let aiComment = '';
  if (tickers.length > 0) {
    try {
      aiComment = await generateSummaryComment({ tickers, timeLabel: timeLabel || '현재' });
      console.log('[Summary] AI 코멘트 생성 완료');
    } catch (err) {
      console.error('[Summary] AI 코멘트 생성 실패:', err);
    }
  }

  // 레이아웃: 헤더 → 구분선 → 코인 → 구분선 → 매크로 → 구분선 → AI 시황
  const parts: string[] = [
    `📊 <b>시장 요약</b>${headerLabel}`,
    `<i>${dateStr}</i>`,
    DIVIDER,
    blocks.join('\n\n'),
    DIVIDER,
  ];

  if (includeMacro) {
    try {
      const macroBlock = await buildMacroBlock();
      parts.push(macroBlock, DIVIDER);
    } catch (err) {
      console.error('[Summary] 매크로 블록 생성 실패:', err);
    }
  }

  if (aiComment) {
    parts.push(`🤖 <b>AI 시황</b>`, aiComment);
  }

  await sendMessage(parts.join('\n'));
  console.log(`[Summary] 전송 완료 (${timeLabel || '수동'})`);
}
