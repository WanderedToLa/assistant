import * as crypto from 'crypto';
import * as fs from 'fs';
import axios from 'axios';
import { config } from '../config';

const BYBIT_API_BASE = 'https://api.bybit.com';

// 수신 허용 시간 오차 (ms) — 바이비트 서버와의 시간 차이 허용 범위
const RECV_WINDOW = 5000;

/** 프라이빗 키를 파일에서 한 번만 읽어 캐시한다 */
let _privateKey: string | null = null;
function getPrivateKey(): string {
  if (!_privateKey) {
    _privateKey = fs.readFileSync(config.bybit.privateKeyPath, 'utf-8');
  }
  return _privateKey;
}

/**
 * RSA-SHA256으로 요청 페이로드에 서명한다
 * 바이비트 서명 규칙: timestamp + apiKey + recvWindow + queryString
 */
function sign(payload: string): string {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(payload);
  return signer.sign(getPrivateKey(), 'base64');
}

/**
 * 바이비트 Private API에 GET 요청을 보낸다 (RSA 인증 포함)
 * - params: 쿼리 파라미터 객체
 */
export async function privateGet<T>(
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const timestamp = Date.now().toString();
  const apiKey = config.bybit.apiKey;

  // 쿼리스트링 생성 (키 알파벳순 정렬)
  const queryString = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();

  // 서명 대상 문자열 조합
  const signPayload = `${timestamp}${apiKey}${RECV_WINDOW}${queryString}`;
  const signature = sign(signPayload);

  const res = await axios.get(`${BYBIT_API_BASE}${path}`, {
    params,
    headers: {
      'X-BAPI-API-KEY':      apiKey,
      'X-BAPI-TIMESTAMP':    timestamp,
      'X-BAPI-RECV-WINDOW':  String(RECV_WINDOW),
      'X-BAPI-SIGN':         signature,
      'X-BAPI-SIGN-TYPE':    '3', // 3 = RSA
    },
  });

  if (res.data.retCode !== 0) {
    throw new Error(`[PrivateClient] API 오류 (${path}): ${res.data.retMsg}`);
  }

  return res.data.result as T;
}
