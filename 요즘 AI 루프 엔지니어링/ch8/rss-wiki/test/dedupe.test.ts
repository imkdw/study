import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupe } from '../src/dedupe/index.ts';
import { openDb } from '../src/db/index.ts';
import type { Db } from '../src/db/index.ts';
import { DEFAULT_CONFIG } from '../src/config.ts';
import type { AppConfig } from '../src/types.ts';
import type { StageCtx } from '../src/stage.ts';
import { createLogger } from '../src/util/log.ts';

function makeCfg(): AppConfig {
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.dedupe.title_similarity_threshold = 0.85;
  return cfg;
}

function insertFeed(db: Db, url = 'https://feed.example.com/rss'): number {
  db.prepare(
    `INSERT INTO feeds (url, name, enabled, seed_categories) VALUES (?, ?, 1, '[]')`,
  ).run(url, 'test feed');
  return Number(db.prepare(`SELECT id FROM feeds WHERE url = ?`).get(url)!.id);
}

let seq = 0;
function insertArticle(
  db: Db,
  feedId: number,
  opts: { title: string; publishedAt: string; url?: string },
): number {
  seq++;
  const url = opts.url ?? `https://a.example.com/article-${seq}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO articles
      (feed_id, guid, url, normalized_url, url_hash, title, raw_content, status, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '본문', 'fetched', ?, ?, ?)`,
  ).run(feedId, url, url, url, `hash-${seq}`, opts.title, opts.publishedAt, now, now);
  return Number(db.prepare(`SELECT id FROM articles WHERE url = ?`).get(url)!.id);
}

function makeCtx(db: Db, cfg: AppConfig): StageCtx {
  return { db, cfg, runId: null, log: createLogger('test') };
}

test('유사 제목 3개가 한 클러스터로 묶이고 canonical 이 가장 오래된 글이다', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);

  const oldest = insertArticle(db, feedId, { title: 'vLLM 0.9 출시', publishedAt: '2026-09-01T00:00:00.000Z' });
  insertArticle(db, feedId, { title: 'vLLM 0.9 출시!', publishedAt: '2026-09-02T00:00:00.000Z' });
  insertArticle(db, feedId, { title: 'vLLM 0.9  출시', publishedAt: '2026-09-03T00:00:00.000Z' });

  const ctx = makeCtx(db, cfg);
  const result = await dedupe(ctx);

  assert.equal(result.clusters, 1);
  assert.equal(result.duplicates, 2);

  const rows = db.prepare(`SELECT id, cluster_id FROM articles`).all() as any[];
  const clusterIds = new Set(rows.map((r) => r.cluster_id));
  assert.equal(clusterIds.size, 1);

  const cluster = db.prepare(`SELECT * FROM clusters`).get() as any;
  assert.equal(cluster.canonical_article_id, oldest);
});

test('상이한 제목은 각각 별도 클러스터로 묶인다', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);

  insertArticle(db, feedId, { title: '오늘의 날씨는 맑음', publishedAt: '2026-09-01T00:00:00.000Z' });
  insertArticle(db, feedId, { title: 'GPU 가격이 폭등했다', publishedAt: '2026-09-02T00:00:00.000Z' });
  insertArticle(db, feedId, { title: '새로운 프레임워크 공개', publishedAt: '2026-09-03T00:00:00.000Z' });

  const ctx = makeCtx(db, cfg);
  const result = await dedupe(ctx);

  assert.equal(result.clusters, 3);
  assert.equal(result.duplicates, 0);
});

test('두 번 돌려도 클러스터가 늘지 않는다 (멱등)', async () => {
  const db = openDb(':memory:');
  const cfg = makeCfg();
  const feedId = insertFeed(db);

  insertArticle(db, feedId, { title: 'vLLM 0.9 출시', publishedAt: '2026-09-01T00:00:00.000Z' });
  insertArticle(db, feedId, { title: 'vLLM 0.9 출시!', publishedAt: '2026-09-02T00:00:00.000Z' });
  insertArticle(db, feedId, { title: '전혀 다른 소식', publishedAt: '2026-09-03T00:00:00.000Z' });

  const ctx = makeCtx(db, cfg);
  const first = await dedupe(ctx);
  assert.equal(first.clusters, 2);

  const clusterCountAfterFirst = (db.prepare(`SELECT COUNT(*) as c FROM clusters`).get() as any).c;

  const second = await dedupe(ctx);
  assert.equal(second.clusters, 0);
  assert.equal(second.duplicates, 0);

  const clusterCountAfterSecond = (db.prepare(`SELECT COUNT(*) as c FROM clusters`).get() as any).c;
  assert.equal(clusterCountAfterFirst, clusterCountAfterSecond);
});
