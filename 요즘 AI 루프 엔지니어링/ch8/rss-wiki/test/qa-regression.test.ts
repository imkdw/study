/**
 * QA 회귀 테스트 (docs/QA-TESTCASES.md 의 결함 D1~D13).
 * 각 테스트는 고친 동작을 고정해서 같은 결함이 다시 들어오지 못하게 한다.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_CONFIG } from '../src/config.ts';
import { openDb } from '../src/db/index.ts';
import type { Db } from '../src/db/index.ts';
import type { AppConfig, SpawnImpl } from '../src/types.ts';
import type { StageCtx } from '../src/stage.ts';
import { enrich } from '../src/enrich/index.ts';
import { compose } from '../src/compose/index.ts';
import { createRewriteFn } from '../src/llm/rewriteRunner.ts';
import { runClaude } from '../src/llm/claudeRunner.ts';
import { reindexFts, searchFts } from '../src/search/fts.ts';
import { createRun, getProgress, requestCancel, setRunStatus } from '../src/jobs/runs.ts';
import { runPipeline } from '../src/jobs/pipeline.ts';
import type { StageFns } from '../src/jobs/pipeline.ts';
import { doctor } from '../src/doctor.ts';

// ---------- 공용 헬퍼 ----------

const NOW = new Date('2026-09-12T00:00:00Z');
const silentLog = { debug() {}, info() {}, warn() {}, error() {} };

function makeCfg(): AppConfig {
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.llm.concurrency = 1;
  cfg.llm.backoff_on_rate_limit_ms = [1, 1, 1];
  cfg.llm.daily_budget_usd = 100;
  cfg.retry.backoff_ms = [1, 1, 1];
  return cfg;
}

function makeCtx(
  db: Db,
  cfg: AppConfig,
  extra: Partial<StageCtx & { spawnImpl: SpawnImpl }> = {},
): StageCtx & { spawnImpl?: SpawnImpl } {
  return { db, cfg, runId: null, log: silentLog, now: () => NOW, ...extra };
}

function lastId(db: Db): number {
  return (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
}

let seq = 0;
function insertFeed(db: Db, name = '테스트 피드'): number {
  seq++;
  db.prepare(`INSERT INTO feeds (url, name, enabled, seed_categories) VALUES (?, ?, 1, '[]')`).run(
    `https://feed.example.com/${seq}`,
    name,
  );
  return lastId(db);
}

function insertArticle(
  db: Db,
  feedId: number,
  opts: { title?: string; status?: string; publishedAt?: string } = {},
): number {
  seq++;
  const url = `https://example.com/a-${seq}`;
  const now = NOW.toISOString();
  db.prepare(
    `INSERT INTO articles
       (feed_id, guid, url, normalized_url, url_hash, title, author, published_at,
        raw_content, content_source, status, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, '테스트 본문입니다.', 'rss', ?, ?, ?)`,
  ).run(
    feedId,
    url,
    url,
    `hash-${seq}`,
    opts.title ?? `제목 ${seq}`,
    opts.publishedAt ?? now,
    opts.status ?? 'fetched',
    now,
    now,
  );
  return lastId(db);
}

function insertCategory(db: Db, slug: string, name: string): number {
  db.prepare(
    `INSERT INTO categories (slug, name, is_seed, status, pending_count, created_at)
     VALUES (?, ?, 1, 'active', 0, ?)`,
  ).run(slug, name, NOW.toISOString());
  return lastId(db);
}

function insertSummary(db: Db, articleId: number, summary: string, oneLiner = '한 줄 요약'): void {
  db.prepare(
    `INSERT INTO summaries
       (article_id, summary_ko, one_liner_ko, key_points_json, entities_json, model,
        input_tokens, output_tokens, cost_usd, created_at)
     VALUES (?, ?, ?, '[]', '[]', 'test-model', 0, 0, 0, ?)`,
  ).run(articleId, summary, oneLiner, NOW.toISOString());
}

function assignCategory(db: Db, articleId: number, categoryId: number): void {
  db.prepare(
    `INSERT INTO article_categories (article_id, category_id, confidence, needs_review)
     VALUES (?, ?, 0.9, 0)`,
  ).run(articleId, categoryId);
}

/** claude -p 출력 형식의 stdout 을 만든다. */
function claudeStdout(
  payload: unknown,
  usage: Partial<{
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
    cost: number;
  }> = {},
): string {
  return JSON.stringify({
    type: 'result',
    subtype: 'success',
    result: typeof payload === 'string' ? payload : JSON.stringify(payload),
    is_error: false,
    usage: {
      input_tokens: usage.input_tokens ?? 10,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 5,
    },
    total_cost_usd: usage.cost ?? 0.001,
  });
}

const GOOD_SUMMARY = {
  summary_ko: '한국어 요약 첫 문장. 두 번째 문장. 세 번째 문장.',
  one_liner_ko: '한 줄 요약입니다',
  category: 'llm',
  is_new_category: false,
  confidence: 0.9,
  key_points: ['포인트1'],
  entities: ['엔티티1'],
};

function tmpWikiDir(): string {
  return mkdtempSync(join(tmpdir(), 'rss-wiki-qa-'));
}

// ---------- D3: 토큰 집계 ----------

describe('D3 토큰 집계', () => {
  test('캐시 생성/재사용 토큰까지 입력 토큰에 합산한다', async () => {
    const spawnImpl: SpawnImpl = async () => ({
      code: 0,
      stdout: claudeStdout('결과', {
        input_tokens: 10,
        cache_creation_input_tokens: 13371,
        cache_read_input_tokens: 13607,
        output_tokens: 40,
      }),
      stderr: '',
    });

    const resp = await runClaude('프롬프트', {
      bin: 'claude',
      model: 'claude-haiku-4-5',
      timeoutMs: 1000,
      spawnImpl,
    });

    assert.equal(resp.usage.input_tokens, 10 + 13371 + 13607);
    assert.equal(resp.usage.output_tokens, 40);
  });
});

// ---------- D2: 예산 초과로 중단된 글 ----------

describe('D2 예산 초과 중단', () => {
  test('예산을 넘겨 중단된 글은 failed 가 아니라 원래 상태로 남는다', async () => {
    const db = openDb(':memory:');
    const cfg = makeCfg();
    cfg.llm.daily_budget_usd = 0.005;
    cfg.llm.concurrency = 1;

    const feedId = insertFeed(db);
    const ids = [insertArticle(db, feedId), insertArticle(db, feedId), insertArticle(db, feedId)];

    // 한 번 호출에 예산을 다 쓰는 비용
    const spawnImpl: SpawnImpl = async () => ({
      code: 0,
      stdout: claudeStdout(GOOD_SUMMARY, { cost: 0.01 }),
      stderr: '',
    });

    const result = await enrich(makeCtx(db, cfg, { spawnImpl }));

    assert.equal(result.ok, 1, '예산 안에서 한 건은 처리된다');
    assert.equal(result.failed, 0, '중단은 실패가 아니다');
    assert.equal(result.interrupted, 2);
    assert.equal(result.partial, true);

    const rows = db
      .prepare(`SELECT id, status, retry_count, failed_reason FROM articles ORDER BY id`)
      .all() as unknown as { id: number; status: string; retry_count: number; failed_reason: string | null }[];

    const remaining = rows.filter((r) => r.id !== ids[0]);
    for (const r of remaining) {
      assert.equal(r.status, 'fetched', '중단된 글은 fetched 로 남아 다음 사이클에 다시 처리된다');
      assert.equal(r.retry_count, 0, '재시도 횟수를 소모하지 않는다');
      assert.equal(r.failed_reason, null);
    }
  });

  test('취소로 중단된 글도 실패로 기록하지 않는다', async () => {
    const db = openDb(':memory:');
    const cfg = makeCfg();
    cfg.llm.concurrency = 1;

    const feedId = insertFeed(db);
    insertArticle(db, feedId);
    insertArticle(db, feedId);

    const controller = new AbortController();
    let calls = 0;
    const spawnImpl: SpawnImpl = async () => {
      calls++;
      controller.abort(); // 첫 호출 직후 취소
      return { code: 0, stdout: claudeStdout(GOOD_SUMMARY, { cost: 0.0001 }), stderr: '' };
    };

    await assert.rejects(
      () => enrich(makeCtx(db, cfg, { spawnImpl, signal: controller.signal })),
      /cancelled/,
    );

    assert.equal(calls, 1);
    const failed = db
      .prepare(`SELECT COUNT(*) AS c FROM articles WHERE status IN ('failed', 'dead_letter')`)
      .get() as unknown as { c: number };
    assert.equal(failed.c, 0, '취소는 실패로 세지 않는다');
  });
});

// ---------- D13: enrich 직후 검색 ----------

describe('D13 검색 인덱스 갱신 시점', () => {
  test('build 를 돌리지 않아도 enrich 직후 검색된다', async () => {
    const db = openDb(':memory:');
    const cfg = makeCfg();
    const feedId = insertFeed(db);
    insertArticle(db, feedId, { title: 'PostgreSQL Migrator 1.0' });

    const spawnImpl: SpawnImpl = async () => ({
      code: 0,
      stdout: claudeStdout(GOOD_SUMMARY, { cost: 0.0001 }),
      stderr: '',
    });

    await enrich(makeCtx(db, cfg, { spawnImpl }));

    const hits = searchFts(db, 'PostgreSQL');
    assert.equal(hits.length, 1);
  });
});

// ---------- D5 / D6: 한국어 검색과 스니펫 ----------

describe('D5/D6 검색 품질', () => {
  test('조사가 붙은 단어도 접두 검색으로 찾는다', () => {
    const db = openDb(':memory:');
    const feedId = insertFeed(db);
    const articleId = insertArticle(db, feedId, { title: 'Migrator 릴리스', status: 'summarized' });
    insertSummary(db, articleId, 'Oracle 에서 PostgreSQL 로의 데이터베이스 마이그레이션을 돕는 도구다.');
    reindexFts(db);

    assert.equal(searchFts(db, '마이그레이션').length, 1, '"마이그레이션을" 토큰도 매칭되어야 한다');
    assert.equal(searchFts(db, '존재하지않는단어').length, 0);
  });

  test('스니펫에 매칭 문맥이 담긴다', () => {
    const db = openDb(':memory:');
    const feedId = insertFeed(db);
    const articleId = insertArticle(db, feedId, { status: 'summarized' });
    insertSummary(db, articleId, '앞부분 설명이 길게 이어진다. 여기서 마이그레이션을 다룬다. 뒷부분도 이어진다.');
    reindexFts(db);

    const [hit] = searchFts(db, '마이그레이션');
    assert.ok(hit.snippet.length > 0, '스니펫이 null 이면 안 된다');
    assert.ok(hit.snippet.includes('마이그레이션'), '질의어 주변을 잘라야 한다');
  });

  test('잘못된 FTS 구문이 들어와도 예외 없이 빈 결과', () => {
    const db = openDb(':memory:');
    assert.deepEqual(searchFts(db, '"unclosed'), []);
    assert.deepEqual(searchFts(db, 'NEAR('), []);
  });
});

// ---------- D4: 아카이빙 ----------

describe('D4 아카이빙', () => {
  test('초과분은 아카이브로 옮기고 본문 타임라인은 한도까지 줄인다', async () => {
    const db = openDb(':memory:');
    const cfg = makeCfg();
    const wikiDir = tmpWikiDir();
    cfg.compose.wiki_dir = wikiDir;
    cfg.compose.timeline_limit = 2;

    const feedId = insertFeed(db, '테스트 피드');
    const catId = insertCategory(db, 'llm', 'LLM');
    for (let i = 0; i < 3; i++) {
      const id = insertArticle(db, feedId, {
        title: `글 ${i}`,
        status: 'summarized',
        publishedAt: new Date(NOW.getTime() - i * 86400000).toISOString(),
      });
      insertSummary(db, id, `요약 ${i}`, `한 줄 ${i}`);
      assignCategory(db, id, catId);
    }

    const first = await compose(makeCtx(db, cfg));
    assert.equal(first.archived, 1, '초과 1건이 아카이브된다');

    const pagePath = join(wikiDir, 'llm.md');
    const page = readFileSync(pagePath, 'utf8');
    const timelineLines = page.split('\n').filter((l) => l.startsWith('- 2026-'));
    assert.equal(timelineLines.length, 2, '본문 타임라인은 timeline_limit 까지만 남는다');
    assert.ok(page.includes('archive/llm-2026.md'), '아카이브 링크가 붙는다');
    assert.ok(existsSync(join(wikiDir, 'archive', 'llm-2026.md')));

    // 두 번째 실행: 바뀐 것이 없으므로 아카이브를 다시 보고하지 않고 파일도 그대로다
    const before = readFileSync(pagePath, 'utf8');
    const second = await compose(makeCtx(db, cfg));
    assert.equal(second.archived, 0, '변경이 없으면 아카이브 0건으로 보고한다');
    assert.equal(readFileSync(pagePath, 'utf8'), before);
  });
});

// ---------- D1: 전체 재작성 연결 ----------

describe('D1 전체 재작성', () => {
  test('createRewriteFn 이 만든 함수로 지금까지의 흐름이 채워진다', async () => {
    const db = openDb(':memory:');
    const cfg = makeCfg();
    const wikiDir = tmpWikiDir();
    cfg.compose.wiki_dir = wikiDir;

    const feedId = insertFeed(db);
    const catId = insertCategory(db, 'llm', 'LLM');
    const articleId = insertArticle(db, feedId, { title: '첫 글', status: 'summarized' });
    insertSummary(db, articleId, '요약', '한 줄');
    assignCategory(db, articleId, catId);

    const spawnImpl: SpawnImpl = async () => ({
      code: 0,
      stdout: claudeStdout(
        {
          narrative: '이 주제는 이렇게 흘러왔다.',
          related: ['infra'],
          week_highlights: ['이번 주 하이라이트'],
        },
        { cost: 0.002 },
      ),
      stderr: '',
    });

    const ctx = makeCtx(db, cfg, { spawnImpl });
    const rewriteFn = createRewriteFn(ctx);
    assert.ok(rewriteFn, '예산이 남아 있으면 재작성 함수를 준다');

    const result = await compose(ctx, { rewriteAll: true, rewriteFn: rewriteFn ?? undefined });
    assert.equal(result.rewritten, 1);

    const page = readFileSync(join(wikiDir, 'llm.md'), 'utf8');
    assert.ok(page.includes('이 주제는 이렇게 흘러왔다.'));
    assert.ok(!page.includes('_아직 없음_'), '흐름 섹션이 비어 있으면 안 된다');
  });

  test('예산이 소진되면 재작성 함수를 만들지 않는다', () => {
    const db = openDb(':memory:');
    const cfg = makeCfg();
    cfg.llm.daily_budget_usd = 0.001;
    db.prepare(
      `INSERT INTO budget_usage (day, cost_usd, tokens_in, tokens_out) VALUES (?, 1.0, 0, 0)`,
    ).run('2026-09-12');

    assert.equal(createRewriteFn(makeCtx(db, cfg)), null);
  });
});

// ---------- D11: 실패 집계 ----------

describe('D11 실패 집계', () => {
  test('진행 페이로드의 errors 가 피드/글 실패를 포함한다', () => {
    const db = openDb(':memory:');
    const runId = createRun(db, 'manual');
    setRunStatus(db, runId, 'done', { feeds_failed: 1, articles_failed: 3 });

    const progress = getProgress(db, runId);
    assert.ok(progress);
    assert.equal(progress.errors, 4);
    assert.deepEqual(progress.errorBreakdown, { stages: 0, feeds: 1, articles: 3 });
  });
});

// ---------- D7: 취소 반응성 ----------

describe('D7 취소 반응성', () => {
  test('스테이지가 도는 도중에 취소해도 단계 경계를 기다리지 않는다', async () => {
    const db = openDb(':memory:');
    const cfg = makeCfg();
    const runId = createRun(db, 'manual');

    let processed = 0;
    const stages = {
      collect: async (ctx: StageCtx) => {
        // 긴 스테이지를 흉내 낸다. 취소 신호가 오면 즉시 빠져나온다.
        for (let i = 0; i < 200; i++) {
          if (ctx.signal?.aborted) break;
          processed++;
          await new Promise((r) => setTimeout(r, 5));
        }
        return { feedsOk: 0, feedsFailed: 0, articlesNew: 0 };
      },
      extract: async () => ({ ok: 0, failed: 0, fallback: 0 }),
      dedupe: async () => ({ clusters: 0, duplicates: 0 }),
      enrich: async () => ({ ok: 0, failed: 0, partial: false, tokensIn: 0, tokensOut: 0, costUsd: 0 }),
      compose: async () => ({ pagesUpdated: 0, rewritten: 0, archived: 0 }),
      build: async () => ({ pages: 0, indexBytes: 0, reduced: false }),
    } as unknown as StageFns;

    const runPromise = runPipeline({
      db,
      cfg,
      runId,
      log: silentLog,
      stages,
      heartbeatMs: 1000,
      cancelPollMs: 5,
    });

    await new Promise((r) => setTimeout(r, 60));
    requestCancel(db, runId);

    const progress = await runPromise;
    assert.equal(progress.status, 'cancelled');
    assert.ok(processed < 200, `취소 시점에 멈춰야 한다 (처리 ${processed}건)`);
  });
});

// ---------- D12: 비용 예측 ----------

describe('D12 비용 예측', () => {
  test('doctor 가 실측 평균으로 하루 비용을 예측하고 한도 초과를 알린다', async () => {
    process.env.RSS_WIKI_SKIP_CLAUDE_CHECK = '1';
    try {
      const db = openDb(':memory:');
      const cfg = makeCfg();
      cfg.llm.daily_budget_usd = 0.5;

      const feedId = insertFeed(db);
      const articleId = insertArticle(db, feedId, { status: 'summarized' });
      db.prepare(
        `INSERT INTO summaries
           (article_id, summary_ko, one_liner_ko, key_points_json, entities_json, model,
            input_tokens, output_tokens, cost_usd, created_at)
         VALUES (?, '요약', '한 줄', '[]', '[]', 'm', 0, 0, 0.039, ?)`,
      ).run(articleId, NOW.toISOString());

      const report = await doctor(db, cfg);
      assert.ok(report.budget.avgCostPerArticle !== null);
      assert.ok((report.budget.projectedDailyCost ?? 0) > cfg.llm.daily_budget_usd);
      assert.equal(report.budget.projectionOverBudget, true);
      assert.ok(report.problems >= 1);
    } finally {
      delete process.env.RSS_WIKI_SKIP_CLAUDE_CHECK;
    }
  });
});
