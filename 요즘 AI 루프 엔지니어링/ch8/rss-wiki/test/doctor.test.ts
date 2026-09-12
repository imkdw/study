import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { openDb, nowIso } from '../src/db/index.ts';
import type { Db } from '../src/db/index.ts';
import type { AppConfig } from '../src/types.ts';
import { doctor, formatReport } from '../src/doctor.ts';

function freshDb(): Db {
  return openDb(':memory:');
}

function freshCfg(): AppConfig {
  return structuredClone(DEFAULT_CONFIG);
}

const okClaude = async () => ({ ok: true, version: 'claude 1.0.0' });

test('모든 것이 정상이면 problems === 0', async () => {
  const db = freshDb();
  const cfg = freshCfg();
  const report = await doctor(db, cfg, { checkClaude: okClaude });
  assert.equal(report.problems, 0);
  assert.equal(report.claude.ok, true);
  assert.deepEqual(report.deadLetter, []);
  assert.deepEqual(report.unhealthyFeeds, []);
  assert.deepEqual(report.pendingCategories, []);
  assert.deepEqual(report.staleJobs, []);
  assert.equal(report.budget.exceeded, false);
});

test('dead_letter 글 / unhealthy 피드 / pending 카테고리 / stale 잡이 각각 잡힌다', async () => {
  const db = freshDb();
  const cfg = freshCfg();
  const ts = nowIso();

  db.prepare('INSERT INTO feeds (url, name) VALUES (?, ?)').run(
    'https://example.com/feed',
    '예시 피드',
  );
  const feedRow = db.prepare('SELECT id FROM feeds WHERE url = ?').get('https://example.com/feed') as {
    id: number;
  };
  db.prepare(
    `UPDATE feeds SET health = 'unhealthy', consecutive_failures = 6 WHERE id = ?`,
  ).run(feedRow.id);

  db.prepare(
    `INSERT INTO articles
       (feed_id, url, normalized_url, url_hash, title, status, failed_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'dead_letter', 'network', ?, ?)`,
  ).run(feedRow.id, 'https://example.com/a1', 'https://example.com/a1', 'hash1', '죽은 글', ts, ts);

  db.prepare(
    `INSERT INTO categories (slug, name, is_seed, status, pending_count, created_at)
     VALUES ('newthing', '새 카테고리', 0, 'active', 2, ?)`,
  ).run(ts);

  const oldHeartbeat = new Date(Date.now() - cfg.server.stale_job_timeout_ms - 60000).toISOString();
  db.prepare(
    `INSERT INTO runs
       (id, trigger, status, heartbeat_at, started_at, created_at)
     VALUES ('run-1', 'manual', 'running', ?, ?, ?)`,
  ).run(oldHeartbeat, oldHeartbeat, ts);

  const report = await doctor(db, cfg, { checkClaude: okClaude });

  assert.equal(report.deadLetter.length, 1);
  assert.equal(report.deadLetter[0]!.title, '죽은 글');

  assert.equal(report.unhealthyFeeds.length, 1);
  assert.equal(report.unhealthyFeeds[0]!.name, '예시 피드');

  assert.equal(report.pendingCategories.length, 1);
  assert.equal(report.pendingCategories[0]!.slug, 'newthing');

  assert.equal(report.staleJobs.length, 1);
  assert.equal(report.staleJobs[0]!.id, 'run-1');

  assert.equal(report.problems, 4);
});

test('checkClaude 가 실패를 돌려주면 claude.ok === false 이고 problems 에 반영된다', async () => {
  const db = freshDb();
  const cfg = freshCfg();
  const report = await doctor(db, cfg, {
    checkClaude: async () => ({ ok: false, message: '실행 파일을 찾을 수 없다' }),
  });
  assert.equal(report.claude.ok, false);
  assert.equal(report.problems, 1);
});

test('formatReport 가 문자열을 돌려주고 주요 항목명을 포함한다', async () => {
  const db = freshDb();
  const cfg = freshCfg();
  const report = await doctor(db, cfg, { checkClaude: okClaude });
  const text = formatReport(report);
  assert.equal(typeof text, 'string');
  assert.ok(text.includes('claude CLI'));
  assert.ok(text.includes('dead_letter'));
  assert.ok(text.includes('불건전 피드'));
  assert.ok(text.includes('승격 대기 카테고리'));
  assert.ok(text.includes('정지된 잡'));
  assert.ok(text.includes('예산'));
});
