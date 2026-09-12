import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { openDb } from '../src/db/index.ts';
import type { Db } from '../src/db/index.ts';
import type { AppConfig, SpawnImpl } from '../src/types.ts';
import type { StageCtx } from '../src/stage.ts';
import { createLogger } from '../src/util/log.ts';
import { enrich } from '../src/enrich/index.ts';
import { pendingCategories } from '../src/enrich/categories.ts';
import { todayKey } from '../src/util/budget.ts';

function makeCfg(): AppConfig {
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.llm.concurrency = 2;
  cfg.llm.backoff_on_rate_limit_ms = [1, 1, 1];
  cfg.llm.daily_budget_usd = 100;
  cfg.categories.seeds = ['llm', 'infra', 'frontend', 'misc'];
  cfg.retry.max_attempts = 3;
  cfg.retry.backoff_ms = [1, 1, 1];
  return cfg;
}

function makeCtx(
  db: Db,
  cfg: AppConfig,
  extra: Partial<StageCtx & { spawnImpl: SpawnImpl }> = {},
): StageCtx & { spawnImpl?: SpawnImpl } {
  return { db, cfg, runId: null, log: createLogger('test'), ...extra };
}

let feedSeq = 0;
function insertFeed(db: Db): number {
  feedSeq++;
  const url = `https://feed.example.com/rss-${feedSeq}`;
  db.prepare(`INSERT INTO feeds (url, name, enabled, seed_categories) VALUES (?, ?, 1, '[]')`).run(url, '테스트 피드');
  return Number(db.prepare('SELECT id FROM feeds WHERE url = ?').get(url)!.id);
}

let articleSeq = 0;
function insertArticle(db: Db, feedId: number, opts: { title?: string; status?: string } = {}): number {
  articleSeq++;
  const url = `https://a.example.com/article-${articleSeq}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO articles
       (feed_id, guid, url, normalized_url, url_hash, title, raw_content, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '이 글은 테스트용 본문입니다.', ?, ?, ?)`,
  ).run(feedId, url, url, url, `hash-${articleSeq}`, opts.title ?? `제목 ${articleSeq}`, opts.status ?? 'fetched', now, now);
  return Number(db.prepare('SELECT id FROM articles WHERE url = ?').get(url)!.id);
}

function claudeJsonResult(payload: unknown, overrides: Partial<{ is_error: boolean; cost: number }> = {}) {
  return JSON.stringify({
    type: 'result',
    subtype: 'success',
    result: typeof payload === 'string' ? payload : JSON.stringify(payload),
    is_error: overrides.is_error ?? false,
    usage: { input_tokens: 10, output_tokens: 5 },
    total_cost_usd: overrides.cost ?? 0.001,
  });
}

function goodEnrichPayload(overrides: Record<string, unknown> = {}) {
  return {
    summary_ko: '이것은 한국어 요약 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다.',
    one_liner_ko: '한 줄 요약입니다',
    category: 'llm',
    is_new_category: false,
    confidence: 0.9,
    key_points: ['포인트1', '포인트2'],
    entities: ['Claude'],
    ...overrides,
  };
}

/** 항상 성공 JSON 을 돌려주는 스텁. */
function makeAlwaysOkSpawn(): SpawnImpl {
  return async () => ({ code: 0, stdout: claudeJsonResult(goodEnrichPayload()), stderr: '' });
}

test('스텁 spawnImpl 로 글 5개를 요약하면 summaries 5행 + status=summarized', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);
  for (let i = 0; i < 5; i++) insertArticle(db, feedId);

  const ctx = makeCtx(db, cfg, { spawnImpl: makeAlwaysOkSpawn() });
  const summary = await enrich(ctx);

  assert.equal(summary.ok, 5);
  assert.equal(summary.failed, 0);
  assert.equal(summary.partial, false);

  const summaryCount = db.prepare('SELECT COUNT(*) AS n FROM summaries').get() as { n: number };
  assert.equal(summaryCount.n, 5);

  const statusCount = db.prepare("SELECT COUNT(*) AS n FROM articles WHERE status = 'summarized'").get() as {
    n: number;
  };
  assert.equal(statusCount.n, 5);
});

test('두 번 돌려도 요약이 다시 생기지 않는다 (멱등)', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);
  for (let i = 0; i < 3; i++) insertArticle(db, feedId);

  let calls = 0;
  const spawnImpl: SpawnImpl = async () => {
    calls++;
    return { code: 0, stdout: claudeJsonResult(goodEnrichPayload()), stderr: '' };
  };

  const ctx = makeCtx(db, cfg, { spawnImpl });
  const first = await enrich(ctx);
  const callsAfterFirst = calls;
  const second = await enrich(ctx);

  assert.equal(first.ok, 3);
  assert.equal(second.ok, 0);
  assert.equal(calls, callsAfterFirst); // 두 번째 실행에서는 호출이 늘지 않는다

  const summaryCount = db.prepare('SELECT COUNT(*) AS n FROM summaries').get() as { n: number };
  assert.equal(summaryCount.n, 3);
});

test('한 글만 실패해도 나머지 4개는 summarized', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);
  const ids: number[] = [];
  for (let i = 0; i < 5; i++) ids.push(insertArticle(db, feedId, { title: `제목-${i}` }));

  const failingId = ids[2];
  const failingUrl = (db.prepare('SELECT url FROM articles WHERE id = ?').get(failingId) as { url: string }).url;
  const spawnImpl: SpawnImpl = async (_bin, _args, stdin) => {
    if (stdin.includes(failingUrl)) {
      return { code: 1, stdout: '', stderr: '알 수 없는 오류' };
    }
    return { code: 0, stdout: claudeJsonResult(goodEnrichPayload()), stderr: '' };
  };

  const ctx = makeCtx(db, cfg, { spawnImpl });
  const summary = await enrich(ctx);

  assert.equal(summary.ok, 4);
  assert.equal(summary.failed, 1);

  const failedRow = db.prepare('SELECT status, failed_reason FROM articles WHERE id = ?').get(failingId) as {
    status: string;
    failed_reason: string;
  };
  assert.equal(failedRow.status, 'failed');
  assert.equal(failedRow.failed_reason, 'llm_error');
});

test('JSON 깨진 응답 -> 1회 재시도 후 성공하면 정상 저장', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);
  const id = insertArticle(db, feedId);

  let calls = 0;
  const spawnImpl: SpawnImpl = async () => {
    calls++;
    if (calls === 1) {
      return { code: 0, stdout: claudeJsonResult('이건 JSON 이 아닙니다. 완전 이상한 문자열이에요 { 깨짐'), stderr: '' };
    }
    return { code: 0, stdout: claudeJsonResult(goodEnrichPayload()), stderr: '' };
  };

  const ctx = makeCtx(db, cfg, { spawnImpl });
  const summary = await enrich(ctx);

  assert.equal(calls, 2);
  assert.equal(summary.ok, 1);
  assert.equal(summary.failed, 0);

  const row = db.prepare('SELECT status FROM articles WHERE id = ?').get(id) as { status: string };
  assert.equal(row.status, 'summarized');
});

test('두 번 다 깨지면 dead_letter + failed_reason=parse', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);
  const id = insertArticle(db, feedId);

  const spawnImpl: SpawnImpl = async () => ({
    code: 0,
    stdout: claudeJsonResult('완전히 깨진 텍스트, JSON 아님'),
    stderr: '',
  });

  const ctx = makeCtx(db, cfg, { spawnImpl });
  const summary = await enrich(ctx);

  assert.equal(summary.ok, 0);
  assert.equal(summary.failed, 1);

  const row = db.prepare('SELECT status, failed_reason FROM articles WHERE id = ?').get(id) as {
    status: string;
    failed_reason: string;
  };
  assert.equal(row.status, 'dead_letter');
  assert.equal(row.failed_reason, 'parse');
});

test('confidence 0.3 -> misc + needs_review=1', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);
  const id = insertArticle(db, feedId);

  const spawnImpl: SpawnImpl = async () => ({
    code: 0,
    stdout: claudeJsonResult(goodEnrichPayload({ category: 'llm', confidence: 0.3 })),
    stderr: '',
  });

  const ctx = makeCtx(db, cfg, { spawnImpl });
  const summary = await enrich(ctx);
  assert.equal(summary.ok, 1);

  const row = db
    .prepare(
      `SELECT c.slug AS slug, ac.needs_review AS needs_review
       FROM article_categories ac JOIN categories c ON c.id = ac.category_id
       WHERE ac.article_id = ?`,
    )
    .get(id) as { slug: string; needs_review: number };

  assert.equal(row.slug, 'misc');
  assert.equal(row.needs_review, 1);
});

test('신규 카테고리 제안 3회 누적 -> status=active 로 승격, 그 전 2회는 misc', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);

  const newCategoryPayload = goodEnrichPayload({
    category: 'webassembly',
    is_new_category: true,
    confidence: 0.9,
  });
  const spawnImpl: SpawnImpl = async () => ({
    code: 0,
    stdout: claudeJsonResult(newCategoryPayload),
    stderr: '',
  });

  const slugOf = (articleId: number): string =>
    (
      db
        .prepare(
          `SELECT c.slug AS slug FROM article_categories ac JOIN categories c ON c.id = ac.category_id WHERE ac.article_id = ?`,
        )
        .get(articleId) as { slug: string }
    ).slug;

  const id1 = insertArticle(db, feedId);
  await enrich(makeCtx(db, cfg, { spawnImpl }));
  assert.equal(slugOf(id1), 'misc');

  let pending = pendingCategories(db);
  assert.equal(pending.find((p) => p.slug === 'webassembly')?.pending_count, 1);

  const id2 = insertArticle(db, feedId);
  await enrich(makeCtx(db, cfg, { spawnImpl }));
  assert.equal(slugOf(id2), 'misc');

  pending = pendingCategories(db);
  assert.equal(pending.find((p) => p.slug === 'webassembly')?.pending_count, 2);

  const id3 = insertArticle(db, feedId);
  await enrich(makeCtx(db, cfg, { spawnImpl }));
  assert.equal(slugOf(id3), 'webassembly');

  const category = db.prepare('SELECT status FROM categories WHERE slug = ?').get('webassembly') as {
    status: string;
  };
  assert.equal(category.status, 'active');
});

test('일일 예산 초과 상태에서 실행하면 호출 0회 + partial=true', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  cfg.llm.daily_budget_usd = 0.01;
  const feedId = insertFeed(db);
  insertArticle(db, feedId);

  const fixedNow = new Date('2026-09-12T03:00:00.000Z');
  const day = todayKey(fixedNow);
  db.prepare('INSERT INTO budget_usage (day, cost_usd, tokens_in, tokens_out) VALUES (?, ?, 0, 0)').run(day, 1);

  let calls = 0;
  const spawnImpl: SpawnImpl = async () => {
    calls++;
    return { code: 0, stdout: claudeJsonResult(goodEnrichPayload()), stderr: '' };
  };

  const ctx = makeCtx(db, cfg, { spawnImpl, now: () => fixedNow });
  const summary = await enrich(ctx);

  assert.equal(calls, 0);
  assert.equal(summary.partial, true);
  assert.equal(summary.ok, 0);
});
