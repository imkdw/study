/** URL 정규화 + 해시. dedupe 와 extract 스테이지가 공유하는 유틸. */

import { createHash } from 'node:crypto';

/**
 * URL 을 정규화한다.
 * - 스킴/호스트 소문자화
 * - 기본 포트(80/443) 제거
 * - 프래그먼트 제거
 * - 트레일링 슬래시 제거 (경로가 `/` 뿐이면 빈 경로로)
 * - stripParams 에 있는 쿼리 파라미터 제거, 남은 쿼리는 키 기준 정렬
 * - `www.` 는 그대로 유지 (과도한 정규화 방지)
 * - 파싱 실패 시 입력을 trim 해서 그대로 반환한다.
 */
export function normalizeUrl(raw: string, stripParams: string[]): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw.trim();
  }

  const protocol = u.protocol.toLowerCase();
  const hostname = u.hostname.toLowerCase();
  let port = u.port;
  if ((protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443')) {
    port = '';
  }

  let pathname = u.pathname;
  if (pathname === '/') {
    pathname = '';
  } else if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  const stripSet = new Set(stripParams);
  const remaining: [string, string][] = [];
  for (const [k, v] of u.searchParams.entries()) {
    if (!stripSet.has(k)) remaining.push([k, v]);
  }
  remaining.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const search = remaining.length
    ? '?' +
      remaining.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';

  const userinfo = u.username ? `${u.username}${u.password ? ':' + u.password : ''}@` : '';
  const host = port ? `${hostname}:${port}` : hostname;

  return `${protocol}//${userinfo}${host}${pathname}${search}`;
}

/** 정규화된 URL 문자열의 sha256 hex 다이제스트. */
export function urlHash(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex');
}
