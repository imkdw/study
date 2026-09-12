import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openDb } from '../src/db/index.ts';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { createLogger } from '../src/util/log.ts';
import { parseFeed } from '../src/collect/feedParser.ts';
import { fetchFeed } from '../src/collect/fetchFeed.ts';
import { collect, recordFeedFailure, recordFeedSuccess, syncFeeds } from '../src/collect/index.ts';
import type { StageCtx } from '../src/stage.ts';
import type { Db } from '../src/db/index.ts';
import type { AppConfig } from '../src/types.ts';

const here = dirname(fileURLToPath(import.meta.url));

// ---------- collect() 테스트가 config/feeds.yaml 을 읽을 수 있도록 임시 작업 디렉터리를 둔다 ----------

const originalCwd = process.cwd();
const workDir = mkdtempSync(join(tmpdir(), 'rss-wiki-collect-'));
mkdirSync(join(workDir, 'config'), { recursive: true });
process.chdir(workDir);

after(() => {
  process.chdir(originalCwd);
  rmSync(workDir, { recursive: true, force: true });
});

function writeFeedsYaml(yamlText: string): void {
  writeFileSync(join(workDir, 'config', 'feeds.yaml'), yamlText, 'utf8');
}

function makeCtx(
  db: Db,
  cfg: AppConfig,
  fetchImpl: typeof fetch,
  nowStr = '2025-02-01T00:00:00.000Z',
): StageCtx {
  return {
    db,
    cfg,
    runId: null,
    log: createLogger('test-collect'),
    fetchImpl,
    now: () => new Date(nowStr),
  };
}

interface FeedItemSpec {
  url: string;
  title: string;
  pubDate: string;
}

function makeRssFeed(items: FeedItemSpec[]): string {
  const itemsXml = items
    .map(
      (it) => `
    <item>
      <title>${it.title}</title>
      <link>${it.url}</link>
      <guid isPermaLink="false">${it.url}</guid>
      <pubDate>${it.pubDate}</pubDate>
      <description>${it.title} 요약</description>
    </item>`,
    )
    .join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>대량 피드</title>${itemsXml}</channel></rss>`;
}

function fixedBodyStub(
  body: string,
  opts: { status?: number; etag?: string; lastModified?: string } = {},
): typeof fetch {
  return (async () => {
    return new Response(body, {
      status: opts.status ?? 200,
      headers: {
        ...(opts.etag ? { etag: opts.etag } : {}),
        ...(opts.lastModified ? { 'last-modified': opts.lastModified } : {}),
      },
    });
  }) as typeof fetch;
}

function countArticles(db: Db): number {
  return (db.prepare('SELECT COUNT(*) AS c FROM articles').get() as { c: number }).c;
}

// ---------- T1.1 feedParser ----------

test('RSS 2.0 파싱: 제목/링크/날짜/본문이 정확히 나온다', () => {
  const body = readFileSync(join(here, 'fixtures', 'rss.xml'), 'utf8');
  const parsed = parseFeed(body);

  assert.equal(parsed.title, 'RSS 샘플 피드');
  assert.equal(parsed.items.length, 2);

  const [a, b] = parsed.items;
  assert.equal(a.title, '첫 번째 글');
  assert.equal(a.url, 'https://example.com/posts/1');
  assert.equal(a.guid, 'rss-guid-1');
  assert.equal(a.author, '홍길동');
  assert.equal(a.published_at, new Date('Wed, 01 Jan 2025 09:00:00 GMT').toISOString());
  assert.equal(a.content, '<p>첫 번째 글의 본문입니다.</p>');
  assert.equal(a.summary, '첫 번째 글 요약');

  assert.equal(b.title, '두 번째 글');
  assert.equal(b.content, '두 번째 글 요약 (본문 없음)');
  assert.equal(b.summary, '두 번째 글 요약 (본문 없음)');
});

test('Atom 파싱: 제목/링크/날짜/본문이 정확히 나온다', () => {
  const body = readFileSync(join(here, 'fixtures', 'atom.xml'), 'utf8');
  const parsed = parseFeed(body);

  assert.equal(parsed.title, 'Atom 샘플 피드');
  assert.equal(parsed.items.length, 2);

  const [a, b] = parsed.items;
  assert.equal(a.title, 'Atom 첫 번째 글');
  assert.equal(a.url, 'https://example.com/atom/1');
  assert.equal(a.guid, 'atom-guid-1');
  assert.equal(a.author, '이영희');
  assert.equal(a.published_at, new Date('2025-01-04T09:00:00Z').toISOString());
  assert.equal(a.content, '<p>Atom 첫 번째 글 본문</p>');
  assert.equal(a.summary, 'Atom 첫 번째 글 요약');

  assert.equal(b.title, 'Atom 두 번째 글');
  assert.equal(b.content, null);
  assert.equal(b.published_at, new Date('2025-01-05T10:00:00Z').toISOString());
  assert.equal(b.summary, 'Atom 두 번째 글 요약 (본문 없음)');
});

test('JSON Feed 파싱: 제목/링크/날짜/본문이 정확히 나온다', () => {
  const body = readFileSync(join(here, 'fixtures', 'jsonfeed.json'), 'utf8');
  const parsed = parseFeed(body);

  assert.equal(parsed.title, 'JSON Feed 샘플');
  assert.equal(parsed.items.length, 2);

  const [a, b] = parsed.items;
  assert.equal(a.title, 'JSON 첫 번째 글');
  assert.equal(a.url, 'https://example.com/json/1');
  assert.equal(a.guid, 'json-guid-1');
  assert.equal(a.author, '최유진');
  assert.equal(a.published_at, new Date('2025-01-06T09:00:00Z').toISOString());
  assert.equal(a.content, '<p>JSON 첫 번째 글 본문</p>');
  assert.equal(a.summary, 'JSON 첫 번째 글 요약');

  assert.equal(b.author, '정하늘');
  assert.equal(b.content, 'JSON 두 번째 글 본문 (텍스트)');
});

test('단일 item 인 RSS 도 배열로 정규화된다', () => {
  const body = readFileSync(join(here, 'fixtures', 'rss-single.xml'), 'utf8');
  const parsed = parseFeed(body);

  assert.equal(Array.isArray(parsed.items), true);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, '유일한 글');
  assert.equal(parsed.items[0].url, 'https://example.com/posts/only');
});

// ---------- T1.2 fetchFeed ----------

test('fetchFeed 는 저장된 etag/last-modified 를 보내고 304 면 notModified 를 반환한다', async () => {
  let sentHeaders: Record<string, string> = {};
  const fetchStub = (async (_url: string, init?: RequestInit) => {
    sentHeaders = Object.fromEntries(new Headers(init?.headers as HeadersInit).entries());
    return new Response(null, { status: 304 });
  }) as typeof fetch;

  const result = await fetchFeed('https://example.com/feed', {
    etag: 'W/"abc"',
    lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT',
    fetchImpl: fetchStub,
  });

  assert.equal(result.status, 304);
  assert.equal(result.notModified, true);
  assert.equal(result.body, null);
  assert.equal(sentHeaders['if-none-match'], 'W/"abc"');
  assert.equal(sentHeaders['if-modified-since'], 'Wed, 01 Jan 2025 00:00:00 GMT');
});

test('fetchFeed 는 200 이면 body 와 etag/last-modified 를 돌려준다', async () => {
  const fetchStub = fixedBodyStub('<rss></rss>', {
    etag: 'W/"v2"',
    lastModified: 'Thu, 02 Jan 2025 00:00:00 GMT',
  });
  const result = await fetchFeed('https://example.com/feed', { fetchImpl: fetchStub });

  assert.equal(result.status, 200);
  assert.equal(result.notModified, false);
  assert.equal(result.body, '<rss></rss>');
  assert.equal(result.etag, 'W/"v2"');
  assert.equal(result.lastModified, 'Thu, 02 Jan 2025 00:00:00 GMT');
});

test('fetchFeed 는 200/304 가 아니면 상태코드를 포함한 에러를 던진다', async () => {
  const fetchStub = fixedBodyStub('server error', { status: 500 });
  await assert.rejects(
    () => fetchFeed('https://example.com/feed', { fetchImpl: fetchStub }),
    /500/,
  );
});

// ---------- T1.3 collect ----------

test('collect 는 같은 피드를 두 번 수집해도 아티클이 늘지 않는다 (멱등)', async () => {
  writeFeedsYaml(
    'feeds:\n  - url: https://feed-a.example.com/rss\n    name: Feed A\n    enabled: true\n',
  );
  const db = openDb(':memory:');
  const cfg = structuredClone(DEFAULT_CONFIG);
  const body = makeRssFeed([
    {
      url: 'https://feed-a.example.com/1',
      title: '글1',
      pubDate: new Date(Date.UTC(2025, 0, 1)).toUTCString(),
    },
    {
      url: 'https://feed-a.example.com/2',
      title: '글2',
      pubDate: new Date(Date.UTC(2025, 0, 2)).toUTCString(),
    },
  ]);
  const ctx = makeCtx(db, cfg, fixedBodyStub(body));

  const first = await collect(ctx);
  assert.equal(first.articlesNew, 2);
  assert.equal(countArticles(db), 2);

  const second = await collect(ctx);
  assert.equal(second.articlesNew, 0);
  assert.equal(countArticles(db), 2);
});

test('백필 한도: 25개짜리 피드 + backfill_limit 20 이면 20개만 들어간다', async () => {
  writeFeedsYaml(
    'feeds:\n  - url: https://feed-b.example.com/rss\n    name: Feed B\n    enabled: true\n',
  );
  const db = openDb(':memory:');
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.collect.backfill_limit = 20;
  cfg.collect.max_articles_per_run = 200;

  const items: FeedItemSpec[] = Array.from({ length: 25 }, (_, i) => ({
    url: `https://feed-b.example.com/item-${i}`,
    title: `글 ${i}`,
    pubDate: new Date(Date.UTC(2025, 0, 1 + i)).toUTCString(),
  }));
  const ctx = makeCtx(db, cfg, fixedBodyStub(makeRssFeed(items)));

  const result = await collect(ctx);
  assert.equal(result.articlesNew, 20);
  assert.equal(countArticles(db), 20);
});

test('max_articles_per_run 상한이 지켜진다', async () => {
  writeFeedsYaml(
    'feeds:\n  - url: https://feed-c.example.com/rss\n    name: Feed C\n    enabled: true\n',
  );
  const db = openDb(':memory:');
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.collect.backfill_limit = 20;
  cfg.collect.max_articles_per_run = 5;

  const items: FeedItemSpec[] = Array.from({ length: 10 }, (_, i) => ({
    url: `https://feed-c.example.com/item-${i}`,
    title: `글 ${i}`,
    pubDate: new Date(Date.UTC(2025, 1, 1 + i)).toUTCString(),
  }));
  const ctx = makeCtx(db, cfg, fixedBodyStub(makeRssFeed(items)));

  const result = await collect(ctx);
  assert.equal(result.articlesNew, 5);
  assert.equal(countArticles(db), 5);
});

test('피드 헬스 전이: 5회 실패 -> unhealthy, 20회 실패 -> disabled, 성공 시 healthy 로 복귀', () => {
  const db = openDb(':memory:');
  const cfg = structuredClone(DEFAULT_CONFIG);
  syncFeeds(db, [
    { url: 'https://feed-h.example.com/rss', name: 'Feed H', seed_categories: [], enabled: true },
  ]);
  const feed = db
    .prepare('SELECT id FROM feeds WHERE url = ?')
    .get('https://feed-h.example.com/rss') as { id: number };

  for (let i = 0; i < 5; i++) recordFeedFailure(db, feed.id, cfg);
  let row = db.prepare('SELECT health, consecutive_failures FROM feeds WHERE id = ?').get(feed.id) as {
    health: string;
    consecutive_failures: number;
  };
  assert.equal(row.health, 'unhealthy');
  assert.equal(row.consecutive_failures, 5);

  for (let i = 0; i < 15; i++) recordFeedFailure(db, feed.id, cfg);
  row = db.prepare('SELECT health, consecutive_failures FROM feeds WHERE id = ?').get(feed.id) as {
    health: string;
    consecutive_failures: number;
  };
  assert.equal(row.health, 'disabled');
  assert.equal(row.consecutive_failures, 20);

  recordFeedSuccess(db, feed.id, {
    etag: null,
    lastModified: null,
    fetchedAt: '2025-01-01T00:00:00.000Z',
  });
  row = db.prepare('SELECT health, consecutive_failures FROM feeds WHERE id = ?').get(feed.id) as {
    health: string;
    consecutive_failures: number;
  };
  assert.equal(row.health, 'healthy');
  assert.equal(row.consecutive_failures, 0);
});

test('피드 하나가 실패해도 다른 피드는 계속 수집된다', async () => {
  writeFeedsYaml(
    'feeds:\n' +
      '  - url: https://feed-ok.example.com/rss\n    name: Feed OK\n    enabled: true\n' +
      '  - url: https://feed-bad.example.com/rss\n    name: Feed Bad\n    enabled: true\n',
  );
  const db = openDb(':memory:');
  const cfg = structuredClone(DEFAULT_CONFIG);

  const okBody = makeRssFeed([
    {
      url: 'https://feed-ok.example.com/1',
      title: '정상 글',
      pubDate: new Date(Date.UTC(2025, 2, 1)).toUTCString(),
    },
  ]);

  const fetchStub = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('feed-ok')) return new Response(okBody, { status: 200 });
    if (url.includes('feed-bad')) throw new Error('network down');
    throw new Error(`unexpected url ${url}`);
  }) as typeof fetch;

  const ctx = makeCtx(db, cfg, fetchStub);
  const result = await collect(ctx);

  assert.equal(result.feedsOk, 1);
  assert.equal(result.feedsFailed, 1);
  assert.equal(result.articlesNew, 1);

  const badFeed = db
    .prepare('SELECT consecutive_failures, health FROM feeds WHERE url = ?')
    .get('https://feed-bad.example.com/rss') as { consecutive_failures: number; health: string };
  assert.equal(badFeed.consecutive_failures, 1);
  assert.equal(badFeed.health, 'healthy');

  const okFeed = db
    .prepare('SELECT consecutive_failures, health FROM feeds WHERE url = ?')
    .get('https://feed-ok.example.com/rss') as { consecutive_failures: number; health: string };
  assert.equal(okFeed.consecutive_failures, 0);
  assert.equal(okFeed.health, 'healthy');
});
