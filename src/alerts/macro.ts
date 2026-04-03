import axios from 'axios';

/** 공포탐욕지수를 조회해 포맷된 문자열을 반환한다 */
async function fetchFearGreed(): Promise<string> {
  const res = await axios.get('https://api.alternative.me/fng/?limit=1');
  const data = res.data.data[0];
  const value = Number(data.value);

  // 등급별 이모지 매핑
  let emoji = '😐';
  if      (value >= 75) emoji = '🤑'; // 극도의 탐욕
  else if (value >= 55) emoji = '😀'; // 탐욕
  else if (value >= 45) emoji = '😐'; // 중립
  else if (value >= 25) emoji = '😨'; // 공포
  else                  emoji = '😱'; // 극도의 공포

  return `공포탐욕지수: <b>${value}</b> — ${data.value_classification} ${emoji}`;
}

/** BTC 도미넌스를 조회해 포맷된 문자열을 반환한다 */
async function fetchBtcDominance(): Promise<string> {
  const res = await axios.get('https://api.coingecko.com/api/v3/global');
  const btcPct = res.data.data.market_cap_percentage.btc as number;
  return `BTC 도미넌스: <b>${btcPct.toFixed(1)}%</b>`;
}

/**
 * 공포탐욕지수 + BTC 도미넌스를 하나의 블록 문자열로 반환한다
 * 개별 항목 조회 실패 시 해당 줄만 에러 표시로 대체한다
 */
export async function buildMacroBlock(): Promise<string> {
  const [fearGreed, dominance] = await Promise.allSettled([
    fetchFearGreed(),
    fetchBtcDominance(),
  ]);

  const lines: string[] = [
    fearGreed.status === 'fulfilled' ? fearGreed.value : '⚠️ 공포탐욕지수 조회 실패',
    dominance.status === 'fulfilled' ? dominance.value : '⚠️ BTC 도미넌스 조회 실패',
  ];

  return lines.join('\n');
}
