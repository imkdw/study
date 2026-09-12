import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, nowIso } from '../src/db/index.ts';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { createLogger } from '../src/util/log.ts';
import type { AppConfig, SpawnImpl } from '../src/types.ts';
import type { StageCtx } from '../src/stage.ts';

const RSS = (n: number) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>테스트 피드</title>
${Array.from({ length: n }, (_, i) => `<item>
  <title>vLLM 연속 배치 처리 개선 ${i}</title>
  <link>https://example.com/post-${i}?utm_source=rss</link>
  <guid>post-${i}</guid>
  <pubDate>Wed, 0${(i % 9) + 1} Sep 2026 09:00:00 +0000</pubDate>
  <description>${'추론 최적화에 관한 긴 본문입니다. '.repeat(60)}</description>
</item>`).join('\n')}
</channel></rss>`;

function makeCfg(dir: string): AppConfig {
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.compose.wiki_dir = join(dir, 'wiki');
  cfg.build.out_dir = join(dir, 'dist');
  cfg.llm.concurrency = 4;
  return cfg;
}

/** claude -p 대신 쓰는 가짜 응답 */
const fakeSpawn: SpawnImpl = async (_bin, _args, stdin) => {
  const title = /제목:\s*(.*)/.exec(stdin)?.[1] ?? '무제';
  const payload = {
    summary_ko: `${title} 에 대한 한국어 요약입니다. 세 문장 이상으로 작성되었습니다. 핵심은 추론 최적화입니다.`,
    one_liner_ko: '연속 배치 처리로 처리량이 늘었다',
    category: 'llm',
    is_new_category: false,
    confidence: 0.9,
    key_points: ['연속 배치', '처리량 개선'],
    entities: ['vLLM'],
  };
  return {
    code: 0,
    stdout: JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: '```json\n' + JSON.stringify(payload) + '\n```',
      usage: { input_tokens: 900, output_tokens: 200 },
      total_cost_usd: 0.0008,
    }),
    stderr: '',
  };
};

function ctxFor(db: ReturnType<typeof openDb>, cfg: AppConfig, fetchImpl?: typeof fetch): StageCtx {
  return { db, cfg, runId: null, log: createLogger('통합'), fetchImpl, skipFeedSync: true };
}

describe('전체 파이프라인 통합', () => {
  test('collect -> extract -> dedupe -> enrich -> compose -> build 가 위키와 사이트를 만든다', async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'rss-wiki-it-'));
    const cfg = makeCfg(dir);
    const db = openDb(':memory:');

    db.prepare(
      "INSERT INTO feeds (url, name, enabled, seed_categories) VALUES ('https://example.com/feed.xml', '테스트 피드', 1, '[\"llm\"]')",
    ).run();

    const fetchImpl = (async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith('feed.xml')) {
        return new Response(RSS(6), { status: 200, headers: { 'content-type': 'application/rss+xml' } });
      }
      if (u.includes('robots.txt')) return new Response('User-agent: *\nDisallow:', { status: 200 });
      return new Response('<html><body><article><p>본문</p></article></body></html>', { status: 200 });
    }) as unknown as typeof fetch;

    const { collect } = await import('../src/collect/index.ts');
    const { extract } = await import('../src/extract/index.ts');
    const { dedupe } = await import('../src/dedupe/index.ts');
    const { enrich } = await import('../src/enrich/index.ts');
    const { compose } = await import('../src/compose/index.ts');
    const { build } = await import('../src/build/index.ts');

    const ctx = ctxFor(db, cfg, fetchImpl);

    // feeds.yaml 을 읽지 않고 DB 의 피드를 그대로 쓰게 한다
    const c = await collect(ctx);
    assert.ok(c.articlesNew >= 1, `수집된 글이 없음: ${JSON.stringify(c)}`);

    const e = await extract(ctx);
    assert.ok(e.ok >= 1);

    await dedupe(ctx);

    const en = await enrich({ ...ctx, spawnImpl: fakeSpawn } as StageCtx & { spawnImpl: SpawnImpl });
    assert.ok(en.ok >= 1, `요약된 글이 없음: ${JSON.stringify(en)}`);
    assert.equal(
      db.prepare("SELECT count(*) c FROM articles WHERE status='summarized'").get()!.c,
      en.ok,
    );

    const cp = await compose(ctx);
    assert.ok(cp.pagesUpdated >= 1);
    const wikiFiles = readdirSync(cfg.compose.wiki_dir).filter((f) => f.endsWith('.md'));
    assert.ok(wikiFiles.includes('llm.md'), `주제 페이지 없음: ${wikiFiles.join(',')}`);

    const b = await build(ctx, { mode: 'local' });
    assert.ok(b.pages >= 1);
    assert.ok(existsSync(join(cfg.build.out_dir, 'llm.html')));
    assert.ok(existsSync(join(cfg.build.out_dir, 'search-index.json')));

    // 검색이 동작한다
    const { search } = await import('../src/search/index.ts');
    const hits = search(db, 'vLLM');
    assert.ok(hits.length >= 1, '검색 결과 없음');

    db.close();
  });

  test('같은 사이클을 두 번 돌려도 결과가 같다 (멱등성)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rss-wiki-idem-'));
    const cfg = makeCfg(dir);
    const db = openDb(':memory:');
    db.prepare(
      "INSERT INTO feeds (url, name, enabled, seed_categories) VALUES ('https://example.com/feed.xml', '테스트 피드', 1, '[\"llm\"]')",
    ).run();

    const fetchImpl = (async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith('feed.xml')) return new Response(RSS(4), { status: 200 });
      if (u.includes('robots.txt')) return new Response('User-agent: *\nDisallow:', { status: 200 });
      return new Response('<html><body><article><p>본문</p></article></body></html>', { status: 200 });
    }) as unknown as typeof fetch;

    const { collect } = await import('../src/collect/index.ts');
    const { extract } = await import('../src/extract/index.ts');
    const { dedupe } = await import('../src/dedupe/index.ts');
    const { enrich } = await import('../src/enrich/index.ts');
    const { compose } = await import('../src/compose/index.ts');
    const ctx = ctxFor(db, cfg, fetchImpl);

    const cycle = async () => {
      await collect(ctx);
      await extract(ctx);
      await dedupe(ctx);
      await enrich({ ...ctx, spawnImpl: fakeSpawn } as StageCtx & { spawnImpl: SpawnImpl });
      await compose(ctx);
    };

    await cycle();
    const first = readFileSync(join(cfg.compose.wiki_dir, 'llm.md'), 'utf8');
    const counts1 = {
      articles: db.prepare('SELECT count(*) c FROM articles').get()!.c,
      summaries: db.prepare('SELECT count(*) c FROM summaries').get()!.c,
      clusters: db.prepare('SELECT count(*) c FROM clusters').get()!.c,
    };

    await cycle();
    const second = readFileSync(join(cfg.compose.wiki_dir, 'llm.md'), 'utf8');
    const counts2 = {
      articles: db.prepare('SELECT count(*) c FROM articles').get()!.c,
      summaries: db.prepare('SELECT count(*) c FROM summaries').get()!.c,
      clusters: db.prepare('SELECT count(*) c FROM clusters').get()!.c,
    };

    assert.deepEqual(counts2, counts1, '두 번째 사이클에서 행이 늘었다');
    assert.equal(second, first, '두 번째 사이클에서 위키 내용이 달라졌다');
    db.close();
  });

  test('잡 파이프라인이 실제 스테이지로 끝까지 돈다', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rss-wiki-job-'));
    const cfg = makeCfg(dir);
    const db = openDb(':memory:');
    const { createRun, getProgress } = await import('../src/jobs/runs.ts');
    const { runPipeline } = await import('../src/jobs/pipeline.ts');

    const runId = createRun(db, 'manual');
    // 실제 네트워크를 타지 않게 피드 동기화를 막고 fetch 를 스텁으로 준다
    const p = await runPipeline({
      db,
      cfg,
      runId,
      log: createLogger('잡', runId, join(dir, 'logs')),
      buildMode: 'local',
      ctxExtra: {
        skipFeedSync: true,
        fetchImpl: (async () => new Response('', { status: 404 })) as unknown as typeof fetch,
      },
    });
    assert.ok(['done', 'partial', 'failed'].includes(p.status), `예상 밖 상태: ${p.status}`);
    const prog = getProgress(db, runId)!;
    assert.equal(Object.keys(prog.stages).length, 6);
    db.close();
  });
});
