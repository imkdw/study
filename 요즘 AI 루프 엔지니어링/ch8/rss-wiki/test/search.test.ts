import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, nowIso } from '../src/db/index.ts';
import type { Db } from '../src/db/index.ts';
import { reindexFts, searchFts } from '../src/search/fts.ts';
import { buildSearchIndex } from '../src/search/index.ts';

function seedFeed(db: Db, url = 'https://example.com/feed'): number {
  const created = nowIso();
  db.prepare(
    `INSERT INTO feeds (url, name, enabled, seed_categories) VALUES (?, ?, 1, '[]')`,
  ).run(url, 'example');
  const row = db.prepare('SELECT id FROM feeds WHERE url = ?').get(url) as { id: number };
  void created;
  return row.id;
}

function insertArticle(
  db: Db,
  feedId: number,
  opts: { title: string; url: string; publishedAt?: string },
): number {
  const now = nowIso();
  db.prepare(
    `INSERT INTO articles
       (feed_id, guid, url, normalized_url, url_hash, title, author, published_at,
        raw_content, content_source, status, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, NULL, NULL, 'summarized', ?, ?)`,
  ).run(
    feedId,
    opts.url,
    opts.url,
    opts.url, // url_hash 는 UNIQUE 제약만 필요하므로 url 을 그대로 재사용
    opts.title,
    opts.publishedAt ?? now,
    now,
    now,
  );
  const row = db.prepare('SELECT id FROM articles WHERE url_hash = ?').get(opts.url) as {
    id: number;
  };
  return row.id;
}

function insertSummary(
  db: Db,
  articleId: number,
  opts: { summary_ko: string; one_liner_ko?: string; key_points?: string[]; entities?: string[] },
): void {
  db.prepare(
    `INSERT INTO summaries
       (article_id, summary_ko, one_liner_ko, key_points_json, entities_json, model,
        input_tokens, output_tokens, cost_usd, created_at)
     VALUES (?, ?, ?, ?, ?, 'test-model', 0, 0, 0, ?)`,
  ).run(
    articleId,
    opts.summary_ko,
    opts.one_liner_ko ?? opts.summary_ko,
    JSON.stringify(opts.key_points ?? []),
    JSON.stringify(opts.entities ?? []),
    nowIso(),
  );
}

function insertCategory(db: Db, slug: string, name = slug): number {
  db.prepare(
    `INSERT INTO categories (slug, name, is_seed, status, pending_count, created_at)
     VALUES (?, ?, 0, 'active', 0, ?)`,
  ).run(slug, name, nowIso());
  const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug) as { id: number };
  return row.id;
}

function linkCategory(
  db: Db,
  articleId: number,
  categoryId: number,
  confidence = 0.9,
): void {
  db.prepare(
    `INSERT INTO article_categories (article_id, category_id, confidence, needs_review)
     VALUES (?, ?, ?, 0)`,
  ).run(articleId, categoryId, confidence);
}

test('reindexFts 후 searchFts 가 영문 키워드로 글을 찾는다', () => {
  const db = openDb(':memory:');
  const feedId = seedFeed(db);
  const articleId = insertArticle(db, feedId, {
    title: 'vLLM 성능 최적화 가이드',
    url: 'https://example.com/a1',
  });
  insertSummary(db, articleId, {
    summary_ko: 'vLLM 을 이용한 추론 서버 최적화 방법을 설명한다.',
    key_points: ['vLLM', '배치 처리'],
    entities: ['vLLM'],
  });
  reindexFts(db);

  const hits = searchFts(db, 'vllm');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.articleId, articleId);
  assert.match(hits[0]?.title ?? '', /vLLM/);
});

test('한국어 요약 단어로도 검색된다', () => {
  const db = openDb(':memory:');
  const feedId = seedFeed(db);
  const articleId = insertArticle(db, feedId, {
    title: 'Rust 비동기 런타임 소개',
    url: 'https://example.com/a2',
  });
  insertSummary(db, articleId, {
    summary_ko: '이 글은 러스트의 비동기 런타임 토키오 소개 글이다.',
  });
  reindexFts(db);

  const hits = searchFts(db, '토키오');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.articleId, articleId);
});

test('FTS5 특수문자가 섞인 쿼리도 예외 없이 처리된다', () => {
  const db = openDb(':memory:');
  const feedId = seedFeed(db);
  const articleId = insertArticle(db, feedId, {
    title: '검색 안전성 테스트',
    url: 'https://example.com/a3',
  });
  insertSummary(db, articleId, { summary_ko: '특수문자 검색 테스트용 요약입니다.' });
  reindexFts(db);

  for (const query of ['"', '*', '-', 'a" OR "b', '--drop', '"unterminated']) {
    assert.doesNotThrow(() => searchFts(db, query));
    const hits = searchFts(db, query);
    assert.ok(Array.isArray(hits));
  }
});

test('검색 결과에 소속 주제 슬러그가 따라온다', () => {
  const db = openDb(':memory:');
  const feedId = seedFeed(db);
  const articleId = insertArticle(db, feedId, {
    title: 'LLM 서빙 아키텍처',
    url: 'https://example.com/a4',
  });
  insertSummary(db, articleId, { summary_ko: 'LLM 서빙 아키텍처를 정리한 글이다.' });
  const categoryId = insertCategory(db, 'llm', 'LLM');
  linkCategory(db, articleId, categoryId);
  reindexFts(db);

  const hits = searchFts(db, 'LLM');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.category, 'llm');
  assert.equal(hits[0]?.pageSlug, 'llm');
});

test('buildSearchIndex 는 상한을 넘으면 축소하고 크기를 상한 이하로 유지한다', () => {
  const db = openDb(':memory:');
  const feedId = seedFeed(db);
  const longSummary = '가'.repeat(2000);

  for (let i = 0; i < 800; i++) {
    const articleId = insertArticle(db, feedId, {
      title: `기사 제목 ${i}`,
      url: `https://example.com/big/${i}`,
      publishedAt: new Date(2026, 0, 1 + (i % 300)).toISOString(),
    });
    insertSummary(db, articleId, {
      summary_ko: longSummary,
      key_points: ['포인트1', '포인트2', '포인트3'],
      entities: ['엔티티1', '엔티티2'],
    });
  }

  const maxBytes = 1024 * 1024;
  const result = buildSearchIndex(db, { maxBytes });
  assert.equal(result.reduced, true);
  assert.ok(Buffer.byteLength(result.json, 'utf8') <= maxBytes);
  assert.ok(result.entries > 0);

  const parsed = JSON.parse(result.json) as unknown[];
  assert.equal(parsed.length, result.entries);
});

test('buildSearchIndex 는 상한 이내면 축소하지 않는다', () => {
  const db = openDb(':memory:');
  const feedId = seedFeed(db);
  const articleId = insertArticle(db, feedId, {
    title: '작은 기사',
    url: 'https://example.com/small',
  });
  insertSummary(db, articleId, { summary_ko: '짧은 요약.' });

  const result = buildSearchIndex(db, { maxBytes: 1024 * 1024 });
  assert.equal(result.reduced, false);
  assert.equal(result.entries, 1);
});
