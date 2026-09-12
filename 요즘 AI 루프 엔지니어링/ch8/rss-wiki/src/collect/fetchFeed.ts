/** 조건부 요청(etag/last-modified)을 지원하는 피드 fetch. */

export interface FetchFeedResult {
  status: number;
  notModified: boolean;
  body: string | null;
  etag: string | null;
  lastModified: string | null;
}

export interface FetchFeedOptions {
  etag?: string | null;
  lastModified?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  userAgent?: string;
}

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_USER_AGENT = 'rss-wiki/1.0 (+https://github.com/rss-wiki; personal feed reader)';

export async function fetchFeed(
  url: string,
  opts: FetchFeedOptions = {},
): Promise<FetchFeedResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;

  const headers: Record<string, string> = { 'User-Agent': userAgent };
  if (opts.etag) headers['If-None-Match'] = opts.etag;
  if (opts.lastModified) headers['If-Modified-Since'] = opts.lastModified;

  const res = await doFetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 304) {
    return { status: 304, notModified: true, body: null, etag: null, lastModified: null };
  }

  if (res.status !== 200) {
    throw new Error(`feed fetch 실패: status ${res.status} (${url})`);
  }

  const body = await res.text();
  return {
    status: 200,
    notModified: false,
    body,
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
  };
}
