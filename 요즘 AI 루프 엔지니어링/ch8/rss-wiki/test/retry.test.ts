import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { openDb, nowIso } from '../src/db/index.ts';
import type { Db } from '../src/db/index.ts';
import type { AppConfig } from '../src/types.ts';
import {
  classifyError,
  nextRetryAt,
  recordFailure,
  dueForRetry,
  resetForRetry,
  withRetry,
} from '../src/util/retry.ts';
import { addUsage, getUsage, isBudgetExceeded } from '../src/util/budget.ts';

function freshDb(): Db {
  return openDb(':memory:');
}

function freshCfg(): AppConfig {
  return structuredClone(DEFAULT_CONFIG);
}

function insertFeed(db: Db, url = 'https://example.com/feed'): number {
  db.prepare('INSERT INTO feeds (url, name) VALUES (?, ?)').run(url, 'example');
  const row = db.prepare('SELECT id FROM feeds WHERE url = ?').get(url) as { id: number };
  return row.id;
}

function insertArticle(db: Db, feedId: number, url = 'https://example.com/a1'): number {
  const ts = nowIso();
  db.prepare(
    `INSERT INTO articles (feed_id, url, normalized_url, url_hash, title, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'discovered', ?, ?)`,
  ).run(feedId, url, url, url, '제목', ts, ts);
  const row = db.prepare('SELECT id FROM articles WHERE url = ?').get(url) as { id: number };
  return row.id;
}

test('classifyError 가 5종을 올바르게 분류한다', () => {
  const abortErr = new Error('operation aborted');
  abortErr.name = 'AbortError';
  assert.equal(classifyError(abortErr), 'timeout');
  assert.equal(classifyError(new Error('요청 timeout 되었다')), 'timeout');

  assert.equal(classifyError(new Error('fetch failed')), 'network');
  assert.equal(classifyError(new Error('ENOTFOUND example.com')), 'network');
  assert.equal(classifyError(new Error('HTTP 503 응답')), 'network');

  assert.equal(classifyError(new SyntaxError('Unexpected token < in JSON')), 'parse');
  assert.equal(classifyError(new Error('failed to parse response')), 'parse');

  assert.equal(classifyError(new Error('rate limit exceeded')), 'llm_error');
  assert.equal(classifyError(new Error('daily usage limit reached')), 'llm_error');

  assert.equal(classifyError(new Error('죄송하지만 도와드릴 수 없습니다')), 'llm_refusal');
  assert.equal(classifyError(new Error('I cannot help with that')), 'llm_refusal');

  assert.equal(classifyError(new Error('그 밖의 알 수 없는 오류')), 'llm_error');
});

test('nextRetryAt 은 backoffMs 범위를 넘으면 null 을 돌려준다', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const backoff = [60000, 300000, 1500000];
  assert.equal(nextRetryAt(1, backoff, now), new Date(now.getTime() + 60000).toISOString());
  assert.equal(nextRetryAt(2, backoff, now), new Date(now.getTime() + 300000).toISOString());
  assert.equal(nextRetryAt(3, backoff, now), new Date(now.getTime() + 1500000).toISOString());
  assert.equal(nextRetryAt(4, backoff, now), null);
});

test('recordFailure 는 1/2회는 failed 로, 3회째는 dead_letter 로 전이한다', () => {
  const db = freshDb();
  const cfg = freshCfg();
  const feedId = insertFeed(db);
  const articleId = insertArticle(db, feedId);
  const now = new Date('2026-01-01T00:00:00.000Z');

  const r1 = recordFailure(db, articleId, new Error('fetch failed'), cfg, now);
  assert.equal(r1.status, 'failed');
  assert.equal(r1.reason, 'network');
  assert.equal(r1.retryCount, 1);
  let row = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId) as {
    next_retry_at: string | null;
    status: string;
  };
  assert.equal(row.status, 'failed');
  assert.equal(row.next_retry_at, new Date(now.getTime() + 60000).toISOString());

  const r2 = recordFailure(db, articleId, new Error('fetch failed'), cfg, now);
  assert.equal(r2.status, 'failed');
  assert.equal(r2.retryCount, 2);
  row = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId) as {
    next_retry_at: string | null;
    status: string;
  };
  assert.equal(row.next_retry_at, new Date(now.getTime() + 300000).toISOString());

  const r3 = recordFailure(db, articleId, new Error('fetch failed'), cfg, now);
  assert.equal(r3.status, 'dead_letter');
  assert.equal(r3.retryCount, 3);
  row = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId) as {
    next_retry_at: string | null;
    status: string;
  };
  assert.equal(row.status, 'dead_letter');
  assert.equal(row.next_retry_at, null);
});

test('dueForRetry 는 시간이 된 것만 돌려준다', () => {
  const db = freshDb();
  const feedId = insertFeed(db);
  const dueId = insertArticle(db, feedId, 'https://example.com/due');
  const notDueId = insertArticle(db, feedId, 'https://example.com/not-due');
  const now = new Date('2026-01-01T00:00:00.000Z');
  const past = new Date(now.getTime() - 1000).toISOString();
  const future = new Date(now.getTime() + 1000000).toISOString();

  db.prepare(
    `UPDATE articles SET status = 'failed', next_retry_at = ? WHERE id = ?`,
  ).run(past, dueId);
  db.prepare(
    `UPDATE articles SET status = 'failed', next_retry_at = ? WHERE id = ?`,
  ).run(future, notDueId);

  const due = dueForRetry(db, now);
  assert.deepEqual(due, [dueId]);

  resetForRetry(db, due);
  const row = db.prepare('SELECT status, next_retry_at FROM articles WHERE id = ?').get(dueId) as {
    status: string;
    next_retry_at: string | null;
  };
  assert.equal(row.status, 'discovered');
  assert.equal(row.next_retry_at, null);
});

test('withRetry 는 2회 실패 후 3번째에 성공한다', async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error('fetch failed');
      return 'ok';
    },
    {
      attempts: 3,
      backoffMs: [10, 20],
      sleepImpl: async (ms) => {
        sleeps.push(ms);
      },
    },
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [10, 20]);
});

test('withRetry 는 shouldRetry 가 false 면 즉시 던진다', async () => {
  let calls = 0;
  const sleeps: number[] = [];
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          calls++;
          throw new Error('죄송하지만 도와드릴 수 없습니다');
        },
        {
          attempts: 3,
          backoffMs: [10, 20],
          sleepImpl: async (ms) => {
            sleeps.push(ms);
          },
          shouldRetry: (e) => classifyError(e) !== 'llm_refusal',
        },
      ),
    /죄송/,
  );
  assert.equal(calls, 1);
  assert.deepEqual(sleeps, []);
});

test('예산: addUsage 누적, isBudgetExceeded 는 한도 초과 시 true, 날짜가 바뀌면 false', () => {
  const db = freshDb();
  const cfg = freshCfg();
  cfg.llm.daily_budget_usd = 0.5;
  const day1 = new Date('2026-01-01T03:00:00.000Z'); // Asia/Seoul 정오
  const day2 = new Date('2026-01-02T03:00:00.000Z');

  addUsage(db, { tokensIn: 1000, tokensOut: 500, costUsd: 0.3 }, day1);
  assert.equal(isBudgetExceeded(db, cfg, day1), false);

  addUsage(db, { tokensIn: 1000, tokensOut: 500, costUsd: 0.3 }, day1);
  const usage = getUsage(db, day1);
  assert.ok(usage.cost_usd >= 0.6);
  assert.equal(isBudgetExceeded(db, cfg, day1), true);

  assert.equal(isBudgetExceeded(db, cfg, day2), false);
});
