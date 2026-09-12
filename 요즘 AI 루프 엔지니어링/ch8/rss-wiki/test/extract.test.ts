import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractReadable, htmlToText } from '../src/extract/readable.ts';
import { DomainRateLimiter, RobotsCache } from '../src/extract/guard.ts';
import { extract } from '../src/extract/index.ts';
import { openDb } from '../src/db/index.ts';
import type { Db } from '../src/db/index.ts';
import { DEFAULT_CONFIG } from '../src/config.ts';
import type { AppConfig } from '../src/types.ts';
import type { StageCtx } from '../src/stage.ts';
import { createLogger } from '../src/util/log.ts';

// ---------- extractReadable / htmlToText ----------

test('extractReadable: nav/footer 를 버리고 본문을 고른다', () => {
  const html = `
    <html><body>
      <div class="nav"><p>홈</p><p>소개</p><p>연락처</p></div>
      <div class="content">
        <p>이 글은 본문 내용을 담고 있는 첫 번째 문단입니다. 충분히 길게 작성되어 있습니다.</p>
        <p>본문의 두 번째 문단도 마찬가지로 꽤 긴 텍스트를 담고 있어야 점수가 높게 나옵니다.</p>
      </div>
      <div class="footer"><p>저작권 2026</p></div>
    </body></html>
  `;
  const out = extractReadable(html, 5000);
  assert.match(out, /본문 내용을 담고 있는 첫 번째 문단/);
  assert.match(out, /본문의 두 번째 문단/);
  assert.doesNotMatch(out, /저작권 2026/);
  assert.doesNotMatch(out, /연락처/);
});

test('extractReadable: article/main 태그를 우선한다', () => {
  const html = `
    <body>
      <div class="sidebar"><p>광고 문구가 아주 길게 이어지고 이어지고 이어집니다 계속 이어집니다</p></div>
      <main><p>메인 콘텐츠입니다.</p></main>
    </body>
  `;
  const out = extractReadable(html, 5000);
  assert.match(out, /메인 콘텐츠입니다/);
  assert.doesNotMatch(out, /광고 문구/);
});

test('extractReadable: HTML 엔티티를 디코드한다', () => {
  const html = `<article><p>Tom &amp; Jerry &lt;둘 다&gt; &quot;최고&quot;&nbsp;다</p></article>`;
  const out = extractReadable(html, 5000);
  assert.equal(out, 'Tom & Jerry <둘 다> "최고" 다');
});

test('extractReadable: maxChars 초과 시 절삭한다', () => {
  const long = 'a'.repeat(200);
  const html = `<article><p>${long}</p></article>`;
  const out = extractReadable(html, 50);
  assert.equal(out.length, 50);
});

test('htmlToText: 태그 제거와 공백 정리', () => {
  const out = htmlToText('<p>hello   \n\n  world</p>');
  assert.equal(out, 'hello world');
});

// ---------- DomainRateLimiter ----------

test('DomainRateLimiter: 같은 도메인 연속 호출에 sleep 을 넣는다', async () => {
  const calls: number[] = [];
  let clock = 0;
  const limiter = new DomainRateLimiter(
    1,
    async (ms: number) => {
      calls.push(ms);
      clock += ms;
    },
    () => clock,
  );

  await limiter.acquire('https://example.com/a');
  await limiter.acquire('https://example.com/b');
  await limiter.acquire('https://other.com/a');

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 1000);
});

// ---------- extract 스테이지 ----------

function makeCfg(): AppConfig {
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.extract.rss_content_min_length = 1000;
  cfg.extract.fetch_timeout_ms = 5000;
  cfg.extract.max_content_chars = 50000;
  return cfg;
}

function insertFeed(db: Db, url = 'https://feed.example.com/rss'): number {
  db.prepare(
    `INSERT INTO feeds (url, name, enabled, seed_categories) VALUES (?, ?, 1, '[]')`,
  ).run(url, 'test feed');
  return Number(db.prepare(`SELECT id FROM feeds WHERE url = ?`).get(url)!.id);
}

function insertArticle(
  db: Db,
  feedId: number,
  opts: { url: string; title: string; rawContent: string },
): number {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO articles
      (feed_id, guid, url, normalized_url, url_hash, title, raw_content, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'discovered', ?, ?)`,
  ).run(
    feedId,
    opts.url,
    opts.url,
    opts.url,
    `hash-${opts.url}`,
    opts.title,
    opts.rawContent,
    now,
    now,
  );
  return Number(db.prepare(`SELECT id FROM articles WHERE url = ?`).get(opts.url)!.id);
}

function makeCtx(db: Db, cfg: AppConfig, fetchImpl?: typeof fetch): StageCtx {
  return {
    db,
    cfg,
    runId: null,
    log: createLogger('test'),
    fetchImpl,
  };
}

test('extract: RSS content 가 1000자 이상이면 그대로 사용하고 content_source=rss', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);
  const longContent = '<p>' + '가나다라 '.repeat(300) + '</p>';
  insertArticle(db, feedId, { url: 'https://a.example.com/1', title: '긴 글', rawContent: longContent });

  let fetchCalls = 0;
  const fetchImpl = (async () => {
    fetchCalls++;
    throw new Error('호출되면 안 된다');
  }) as unknown as typeof fetch;

  const ctx = makeCtx(db, cfg, fetchImpl);
  const result = await extract(ctx);

  assert.equal(result.ok, 1);
  assert.equal(fetchCalls, 0);
  const row = db.prepare(`SELECT * FROM articles WHERE url = ?`).get('https://a.example.com/1') as any;
  assert.equal(row.content_source, 'rss');
  assert.equal(row.status, 'fetched');
});

test('extract: RSS content 미달 + fetch 성공이면 content_source=fetched', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);
  insertArticle(db, feedId, {
    url: 'https://b.example.com/1',
    title: '짧은 글',
    rawContent: '<p>짧은 요약</p>',
  });

  const longFetched = '<article><p>' + '본문내용입니다 '.repeat(300) + '</p></article>';

  const fetchImpl = (async (input: string | URL) => {
    const url = String(input);
    if (url.includes('robots.txt')) {
      return new Response('', { status: 404 });
    }
    return new Response(longFetched, { status: 200 });
  }) as unknown as typeof fetch;

  const ctx = makeCtx(db, cfg, fetchImpl);
  const result = await extract(ctx);

  assert.equal(result.ok, 1);
  const row = db.prepare(`SELECT * FROM articles WHERE url = ?`).get('https://b.example.com/1') as any;
  assert.equal(row.content_source, 'fetched');
  assert.equal(row.status, 'fetched');
  assert.match(row.raw_content, /본문내용입니다/);
});

test('extract: fetch 실패 시 rss_fallback 으로 폴백한다', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);
  insertArticle(db, feedId, {
    url: 'https://c.example.com/1',
    title: '짧은 글',
    rawContent: '<p>짧은 요약 내용입니다</p>',
  });

  const fetchImpl = (async (input: string | URL) => {
    const url = String(input);
    if (url.includes('robots.txt')) {
      return new Response('', { status: 404 });
    }
    throw new Error('network error');
  }) as unknown as typeof fetch;

  const ctx = makeCtx(db, cfg, fetchImpl);
  const result = await extract(ctx);

  assert.equal(result.ok, 1);
  assert.equal(result.fallback, 1);
  const row = db.prepare(`SELECT * FROM articles WHERE url = ?`).get('https://c.example.com/1') as any;
  assert.equal(row.content_source, 'rss_fallback');
  assert.match(row.raw_content, /짧은 요약 내용입니다/);
});

test('extract: robots 불허면 본문 fetch 를 시도하지 않는다', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);
  insertArticle(db, feedId, {
    url: 'https://d.example.com/blocked',
    title: '짧은 글',
    rawContent: '<p>짧은 요약 내용입니다</p>',
  });

  let contentFetchCalls = 0;
  const fetchImpl = (async (input: string | URL) => {
    const url = String(input);
    if (url.includes('robots.txt')) {
      return new Response('User-agent: *\nDisallow: /blocked', { status: 200 });
    }
    contentFetchCalls++;
    return new Response('<article><p>should not be fetched</p></article>', { status: 200 });
  }) as unknown as typeof fetch;

  const ctx = makeCtx(db, cfg, fetchImpl);
  const result = await extract(ctx);

  assert.equal(contentFetchCalls, 0);
  assert.equal(result.fallback, 1);
  const row = db.prepare(`SELECT * FROM articles WHERE url = ?`).get('https://d.example.com/blocked') as any;
  assert.equal(row.content_source, 'rss_fallback');
});

// ---------- RobotsCache ----------

test('RobotsCache: Disallow prefix 를 해석해서 차단한다', async () => {
  const fetchImpl = (async () =>
    new Response('User-agent: *\nDisallow: /private\n', { status: 200 })) as unknown as typeof fetch;
  const cache = new RobotsCache({ fetchImpl, userAgent: 'rss-wiki/1.0', timeoutMs: 1000 });

  assert.equal(await cache.isAllowed('https://x.example.com/private/1'), false);
  assert.equal(await cache.isAllowed('https://x.example.com/public/1'), true);
});

test('RobotsCache: fetch 실패/404 면 허용으로 본다', async () => {
  const fetchImpl = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
  const cache = new RobotsCache({ fetchImpl, userAgent: 'rss-wiki/1.0', timeoutMs: 1000 });
  assert.equal(await cache.isAllowed('https://y.example.com/anything'), true);
});
