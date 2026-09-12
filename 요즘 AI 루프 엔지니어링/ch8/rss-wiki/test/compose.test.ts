import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { openDb } from '../src/db/index.ts';
import type { Db } from '../src/db/index.ts';
import { DEFAULT_CONFIG } from '../src/config.ts';
import type { AppConfig, PageData } from '../src/types.ts';
import type { StageCtx } from '../src/stage.ts';
import { buildPageData, compose } from '../src/compose/index.ts';
import { renderPage, renderArchive, renderIndex, slugToPath, parsePage } from '../src/compose/render.ts';

// ---------- 테스트 헬퍼 (FK 순서: feeds -> articles -> summaries -> categories -> article_categories) ----------

let seq = 0;
function nextSeq(): number {
  seq++;
  return seq;
}

function lastId(db: Db): number {
  return (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
}

function insertFeed(db: Db, name: string, url?: string): number {
  const u = url ?? `https://feed.example.com/${nextSeq()}`;
  db.prepare(
    `INSERT INTO feeds (url, name, enabled, seed_categories) VALUES (?, ?, 1, '[]')`,
  ).run(u, name);
  return lastId(db);
}

function insertCategory(db: Db, slug: string, name: string): number {
  db.prepare(
    `INSERT INTO categories (slug, name, is_seed, status, pending_count, created_at)
     VALUES (?, ?, 1, 'active', 0, ?)`,
  ).run(slug, name, new Date().toISOString());
  return lastId(db);
}

function insertArticle(
  db: Db,
  opts: { feedId: number; title: string; publishedAt: string | null; status?: string },
): number {
  const n = nextSeq();
  const url = `https://example.com/article-${n}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO articles
       (feed_id, guid, url, normalized_url, url_hash, title, author, published_at,
        raw_content, content_source, status, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, NULL, 'fetched', ?, ?, ?)`,
  ).run(
    opts.feedId,
    url,
    url,
    `hash-${n}`,
    opts.title,
    opts.publishedAt,
    opts.status ?? 'summarized',
    now,
    now,
  );
  return lastId(db);
}

function insertSummary(db: Db, articleId: number, oneLiner: string, summary = '요약 본문'): void {
  db.prepare(
    `INSERT INTO summaries
       (article_id, summary_ko, one_liner_ko, key_points_json, entities_json, model,
        input_tokens, output_tokens, cost_usd, created_at)
     VALUES (?, ?, ?, '[]', '[]', 'test-model', 0, 0, 0, ?)`,
  ).run(articleId, summary, oneLiner, new Date().toISOString());
}

function assignCategory(db: Db, articleId: number, categoryId: number, confidence = 0.9): void {
  db.prepare(
    `INSERT INTO article_categories (article_id, category_id, confidence, needs_review)
     VALUES (?, ?, ?, 0)`,
  ).run(articleId, categoryId, confidence);
}

/** canonicalId 를 canonical 로, memberIds 를 같은 클러스터의 다른 글로 묶는다. */
function makeCluster(db: Db, canonicalId: number, memberIds: number[]): number {
  db.prepare(
    `INSERT INTO clusters (canonical_article_id, title_normalized, created_at) VALUES (?, 'x', ?)`,
  ).run(canonicalId, new Date().toISOString());
  const clusterId = lastId(db);
  for (const id of [canonicalId, ...memberIds]) {
    db.prepare('UPDATE articles SET cluster_id = ? WHERE id = ?').run(clusterId, id);
  }
  return clusterId;
}

function makeCfg(wikiDir: string): AppConfig {
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.compose.wiki_dir = wikiDir;
  return cfg;
}

function makeCtx(
  db: Db,
  cfg: AppConfig,
  now: Date,
  extra?: Partial<StageCtx>,
): StageCtx {
  return {
    db,
    cfg,
    runId: null,
    log: { debug() {}, info() {}, warn() {}, error() {} },
    now: () => now,
    ...extra,
  };
}

function tmpWikiDir(): string {
  return mkdtempSync(join(tmpdir(), 'rss-wiki-'));
}

const NOW = new Date('2026-09-12T00:00:00Z');

function daysAgoIso(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- 1. renderPage 스냅샷 ----------

describe('renderPage', () => {
  test('필수 섹션 5개가 순서대로 들어간다', () => {
    const page: PageData = {
      slug: 'llm-inference',
      name: 'LLM 추론 최적화',
      updatedAt: '2026-09-12',
      itemCount: 48,
      feedCount: 5,
      weekRange: '9/6~9/12',
      weekHighlights: ['핵심 줄 1', '핵심 줄 2'],
      narrative: '누적된 서술형 정리.',
      timeline: [
        {
          date: '2026-09-12',
          title: '제목',
          one_liner: '한줄요약',
          sources: [{ name: '출처1', url: 'https://a.example.com' }],
        },
      ],
      related: ['vllm-serving', 'gpu-cost'],
      sources: ['피드A', '피드B'],
    };

    const md = renderPage(page);
    const order = [
      '## 이번 주 (9/6~9/12)',
      '## 지금까지의 흐름',
      '## 타임라인',
      '## 관련 주제',
      '## 출처',
    ];
    let lastIdx = -1;
    for (const heading of order) {
      const idx = md.indexOf(heading);
      assert.ok(idx !== -1, `${heading} 섹션이 없다`);
      assert.ok(idx > lastIdx, `${heading} 섹션 순서가 잘못됐다`);
      lastIdx = idx;
    }
    assert.match(md, /^# LLM 추론 최적화/);
    assert.match(md, /마지막 갱신: 2026-09-12 \/ 누적 항목 48개 \/ 구독 피드 5개/);
    assert.match(md, /2026-09-12 \/ 제목 \/ 한줄요약 \[출처1\]\(https:\/\/a\.example\.com\)/);
    assert.match(md, /- \[\[vllm-serving\]\] \/ \[\[gpu-cost\]\]/);
  });

  test('빈 섹션은 헤딩은 유지하고 _아직 없음_ 을 넣는다', () => {
    const page: PageData = {
      slug: 'empty',
      name: '빈 주제',
      updatedAt: '2026-09-12',
      itemCount: 0,
      feedCount: 0,
      weekRange: '9/6~9/12',
      weekHighlights: [],
      narrative: '',
      timeline: [],
      related: [],
      sources: [],
    };
    const md = renderPage(page);
    const emptyCount = (md.match(/_아직 없음_/g) ?? []).length;
    // 이번 주 / 지금까지의 흐름 / 타임라인 / 관련 주제 / 출처 -> 5개 섹션 모두 비어 있다.
    assert.equal(emptyCount, 5);
  });

  test('parsePage 로 지금까지의 흐름 본문만 복구한다', () => {
    const page: PageData = {
      slug: 's',
      name: 'S',
      updatedAt: '2026-09-12',
      itemCount: 1,
      feedCount: 1,
      weekRange: '9/6~9/12',
      weekHighlights: [],
      narrative: '여러 줄짜리\n서술형 정리입니다.',
      timeline: [],
      related: [],
      sources: [],
    };
    const md = renderPage(page);
    const recovered = parsePage(md);
    assert.equal(recovered.narrative, '여러 줄짜리\n서술형 정리입니다.');
  });

  test('parsePage: 흐름이 비어있던 페이지는 빈 문자열을 돌려준다', () => {
    const page: PageData = {
      slug: 's',
      name: 'S',
      updatedAt: '2026-09-12',
      itemCount: 0,
      feedCount: 0,
      weekRange: '9/6~9/12',
      weekHighlights: [],
      narrative: '',
      timeline: [],
      related: [],
      sources: [],
    };
    const recovered = parsePage(renderPage(page));
    assert.equal(recovered.narrative, '');
  });

  test('renderArchive / renderIndex / slugToPath 기본 동작', () => {
    const archiveMd = renderArchive('slug-a', '이름 A', '2025', [
      {
        date: '2025-12-01',
        title: '옛날 글',
        one_liner: '한줄',
        sources: [{ name: '피드', url: 'https://x.example.com' }],
      },
    ]);
    assert.match(archiveMd, /# 이름 A - 2025년 아카이브/);
    assert.match(archiveMd, /2025-12-01 \/ 옛날 글 \/ 한줄/);

    const indexMd = renderIndex(
      [{ slug: 'b', name: 'B 주제', itemCount: 3, updatedAt: '2026-09-12', highlights: ['h1'] }],
      '2026-09-12',
    );
    assert.match(indexMd, /## 주제 목록/);
    assert.match(indexMd, /\[B 주제\]\(b\.md\)/);

    assert.equal(slugToPath('docs/wiki', 'llm'), join('docs/wiki', 'llm.md'));
  });
});

// ---------- 2. 클러스터 출처 병기 ----------

test('클러스터 항목은 출처 2개를 병기한다', () => {
  const wikiDir = tmpWikiDir();
  const db = openDb(':memory:');
  const cfg = makeCfg(wikiDir);

  const feedA = insertFeed(db, '피드A');
  const feedB = insertFeed(db, '피드B');
  const catId = insertCategory(db, 'llm', 'LLM');

  const canonical = insertArticle(db, {
    feedId: feedA,
    title: '대표 글',
    publishedAt: daysAgoIso(0),
  });
  insertSummary(db, canonical, '대표 한줄');
  assignCategory(db, canonical, catId);

  const dup = insertArticle(db, {
    feedId: feedB,
    title: '중복 글',
    publishedAt: daysAgoIso(0),
  });
  // 중복 글은 enrich 대상이 아니므로 summaries/article_categories 없이 cluster_id 만 공유한다.
  makeCluster(db, canonical, [dup]);

  const page = buildPageData(db, cfg, catId, NOW);
  assert.equal(page.timeline.length, 1);
  assert.equal(page.timeline[0].sources.length, 2);
  const names = page.timeline[0].sources.map((s) => s.name).sort();
  assert.deepEqual(names, ['피드A', '피드B']);
});

// ---------- 3. 증분 갱신 ----------

test('증분: 새 글이 늘어도 narrative 는 보존된다', async () => {
  const wikiDir = tmpWikiDir();
  const db = openDb(':memory:');
  const cfg = makeCfg(wikiDir);

  const feedId = insertFeed(db, '피드');
  const catId = insertCategory(db, 'infra', '인프라');

  for (let i = 0; i < 3; i++) {
    const id = insertArticle(db, { feedId, title: `글${i}`, publishedAt: daysAgoIso(i) });
    insertSummary(db, id, `한줄${i}`);
    assignCategory(db, id, catId);
  }

  const ctx1 = makeCtx(db, cfg, NOW);
  const result1 = await compose(ctx1);
  assert.equal(result1.pagesUpdated, 1);

  db.prepare('UPDATE pages SET narrative = ? WHERE category_id = ?').run(
    '이 주제는 여기서 시작했다.',
    catId,
  );

  for (let i = 3; i < 5; i++) {
    const id = insertArticle(db, { feedId, title: `글${i}`, publishedAt: daysAgoIso(-i) });
    insertSummary(db, id, `한줄${i}`);
    assignCategory(db, id, catId);
  }

  const ctx2 = makeCtx(db, cfg, NOW);
  const result2 = await compose(ctx2);
  assert.equal(result2.pagesUpdated, 1);

  const pageRow = db
    .prepare('SELECT narrative, item_count FROM pages WHERE category_id = ?')
    .get(catId) as { narrative: string; item_count: number };
  assert.equal(pageRow.narrative, '이 주제는 여기서 시작했다.');
  assert.equal(pageRow.item_count, 5);

  const md = readFileSync(slugToPath(wikiDir, 'infra'), 'utf8');
  assert.match(md, /이 주제는 여기서 시작했다\./);
  const timelineLines = md.match(/^- \d{4}-\d{2}-\d{2} \/ /gm) ?? [];
  assert.equal(timelineLines.length, 5);
});

// ---------- 4. 아카이빙 ----------

test('타임라인 30개 초과분은 연도별 아카이브로 이동한다', async () => {
  const wikiDir = tmpWikiDir();
  const db = openDb(':memory:');
  const cfg = makeCfg(wikiDir);

  const feedId = insertFeed(db, '피드');
  const catId = insertCategory(db, 'llm', 'LLM');

  for (let i = 0; i < 35; i++) {
    const id = insertArticle(db, { feedId, title: `글${i}`, publishedAt: daysAgoIso(i) });
    insertSummary(db, id, `한줄${i}`);
    assignCategory(db, id, catId);
  }

  const ctx = makeCtx(db, cfg, NOW);
  const result = await compose(ctx);
  assert.equal(result.archived, 5);

  const page = buildPageData(db, cfg, catId, NOW);
  assert.equal(page.itemCount, 35);
  assert.equal(page.timeline.length, 30);

  const archivePath = join(wikiDir, 'archive', 'llm-2026.md');
  assert.ok(existsSync(archivePath), '아카이브 파일이 생성돼야 한다');
  const archiveMd = readFileSync(archivePath, 'utf8');
  const archivedLines = archiveMd.match(/^- \d{4}-\d{2}-\d{2} \/ /gm) ?? [];
  assert.equal(archivedLines.length, 5);

  const mainMd = readFileSync(slugToPath(wikiDir, 'llm'), 'utf8');
  assert.match(mainMd, /아카이브/);
});

// ---------- 5. 멱등성 ----------

test('같은 DB 상태로 두 번 compose 하면 파일이 바이트 단위로 동일하다', async () => {
  const wikiDir = tmpWikiDir();
  const db = openDb(':memory:');
  const cfg = makeCfg(wikiDir);

  const feedId = insertFeed(db, '피드');
  const catId = insertCategory(db, 'career', '커리어');
  for (let i = 0; i < 4; i++) {
    const id = insertArticle(db, { feedId, title: `글${i}`, publishedAt: daysAgoIso(i) });
    insertSummary(db, id, `한줄${i}`);
    assignCategory(db, id, catId);
  }

  await compose(makeCtx(db, cfg, NOW));
  const pageMd1 = readFileSync(slugToPath(wikiDir, 'career'), 'utf8');
  const indexMd1 = readFileSync(join(wikiDir, 'index.md'), 'utf8');

  await compose(makeCtx(db, cfg, NOW));
  const pageMd2 = readFileSync(slugToPath(wikiDir, 'career'), 'utf8');
  const indexMd2 = readFileSync(join(wikiDir, 'index.md'), 'utf8');

  assert.equal(pageMd1, pageMd2);
  assert.equal(indexMd1, indexMd2);
});

// ---------- 6. 재작성 실패 시 원본 유지 ----------

test('재작성 실패 시 기존 파일 내용이 보존된다', async () => {
  const wikiDir = tmpWikiDir();
  const db = openDb(':memory:');
  const cfg = makeCfg(wikiDir);

  const feedId = insertFeed(db, '피드');
  const catId = insertCategory(db, 'security', '보안');
  const id = insertArticle(db, { feedId, title: '글', publishedAt: daysAgoIso(0) });
  insertSummary(db, id, '한줄');
  assignCategory(db, id, catId);

  await compose(makeCtx(db, cfg, NOW));
  const before = readFileSync(slugToPath(wikiDir, 'security'), 'utf8');

  const result = await compose(
    makeCtx(db, cfg, NOW),
    {
      rewriteAll: true,
      rewriteFn: async () => {
        throw new Error('LLM 실패');
      },
    },
  );
  assert.equal(result.rewritten, 0);

  const after = readFileSync(slugToPath(wikiDir, 'security'), 'utf8');
  assert.equal(before, after);
});

// ---------- 7. 재작성 성공 ----------

test('재작성 성공 시 narrative 가 바뀌고 items_since_rewrite 가 0이 된다', async () => {
  const wikiDir = tmpWikiDir();
  const db = openDb(':memory:');
  const cfg = makeCfg(wikiDir);

  const feedId = insertFeed(db, '피드');
  const catId = insertCategory(db, 'database', 'DB');
  const id = insertArticle(db, { feedId, title: '글', publishedAt: daysAgoIso(0) });
  insertSummary(db, id, '한줄');
  assignCategory(db, id, catId);

  await compose(makeCtx(db, cfg, NOW));

  const result = await compose(makeCtx(db, cfg, NOW), {
    rewriteAll: true,
    rewriteFn: async () => ({
      narrative: 'LLM 이 다시 쓴 흐름',
      related: ['other-topic'],
      week_highlights: ['새 하이라이트'],
    }),
  });

  assert.equal(result.rewritten, 1);

  const md = readFileSync(slugToPath(wikiDir, 'database'), 'utf8');
  assert.match(md, /LLM 이 다시 쓴 흐름/);
  assert.match(md, /\[\[other-topic\]\]/);

  const row = db
    .prepare('SELECT items_since_rewrite, related_json FROM pages WHERE category_id = ?')
    .get(catId) as { items_since_rewrite: number; related_json: string };
  assert.equal(row.items_since_rewrite, 0);
  assert.deepEqual(JSON.parse(row.related_json), ['other-topic']);
});

// ---------- 8. 재작성 동시 실행 제한 ----------

test('재작성 동시 실행 수는 rewrite_concurrency(2) 를 넘지 않는다', async () => {
  const wikiDir = tmpWikiDir();
  const db = openDb(':memory:');
  const cfg = makeCfg(wikiDir);

  const feedId = insertFeed(db, '피드');
  for (let c = 0; c < 4; c++) {
    const catId = insertCategory(db, `topic-${c}`, `주제${c}`);
    const id = insertArticle(db, { feedId, title: `글${c}`, publishedAt: daysAgoIso(0) });
    insertSummary(db, id, `한줄${c}`);
    assignCategory(db, id, catId);
  }

  await compose(makeCtx(db, cfg, NOW));

  let concurrent = 0;
  let maxConcurrent = 0;
  const result = await compose(makeCtx(db, cfg, NOW), {
    rewriteAll: true,
    rewriteFn: async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(30);
      concurrent--;
      return { narrative: '재작성됨', related: [], week_highlights: [] };
    },
  });

  assert.equal(result.rewritten, 4);
  assert.ok(maxConcurrent <= 2, `동시 실행 수가 2를 넘었다: ${maxConcurrent}`);
  assert.equal(maxConcurrent, 2, '동시성 2가 실제로 활용돼야 한다');
});

// ---------- 9. 항목 0개 카테고리는 페이지를 만들지 않는다 ----------

test('항목 0개 카테고리는 파일이 생기지 않는다', async () => {
  const wikiDir = tmpWikiDir();
  const db = openDb(':memory:');
  const cfg = makeCfg(wikiDir);

  insertCategory(db, 'empty-topic', '빈 주제');
  // articles/summaries 전혀 없음.

  const result = await compose(makeCtx(db, cfg, NOW));
  assert.equal(result.pagesUpdated, 0);
  assert.equal(existsSync(slugToPath(wikiDir, 'empty-topic')), false);
});

// ---------- 10. index.md ----------

test('index.md 에 주제 목록이 들어간다', async () => {
  const wikiDir = tmpWikiDir();
  const db = openDb(':memory:');
  const cfg = makeCfg(wikiDir);

  const feedId = insertFeed(db, '피드');
  const catId = insertCategory(db, 'frontend', '프론트엔드');
  const id = insertArticle(db, { feedId, title: '글', publishedAt: daysAgoIso(0) });
  insertSummary(db, id, '한줄');
  assignCategory(db, id, catId);

  await compose(makeCtx(db, cfg, NOW));

  const indexMd = readFileSync(join(wikiDir, 'index.md'), 'utf8');
  assert.match(indexMd, /## 주제 목록/);
  assert.match(indexMd, /\[프론트엔드\]\(frontend\.md\)/);
});
