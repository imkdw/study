import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, nowIso, bool, tx } from '../src/db/index.ts';
import {
  loadConfig,
  loadFeeds,
  mergeDeep,
  normalizeConfig,
  DEFAULT_CONFIG,
  MAX_LLM_CONCURRENCY,
} from '../src/config.ts';
import { createLogger, tailLog, setLevel } from '../src/util/log.ts';
import { STAGES } from '../src/types.ts';

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'rss-wiki-core-'));
}

describe('db', () => {
  test('스키마가 PRD 7절 테이블을 전부 만든다', () => {
    const db = openDb(':memory:');
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view')")
      .all()
      .map((r) => String((r as { name: string }).name));
    for (const t of [
      'feeds',
      'articles',
      'summaries',
      'categories',
      'article_categories',
      'clusters',
      'pages',
      'runs',
      'run_stages',
      'articles_fts',
    ]) {
      assert.ok(names.includes(t), `테이블 누락: ${t}`);
    }
    db.close();
  });

  test('one_active_run 부분 유니크 인덱스가 동시 실행을 1개로 막는다', () => {
    const db = openDb(':memory:');
    const ins = db.prepare(
      "INSERT INTO runs (id, trigger, status, created_at) VALUES (?, 'manual', ?, ?)",
    );
    ins.run('run_a', 'running', nowIso());
    assert.throws(() => ins.run('run_b', 'queued', nowIso()));
    // 끝난 잡은 제약에 걸리지 않는다
    db.prepare("UPDATE runs SET status='done' WHERE id='run_a'").run();
    ins.run('run_b', 'queued', nowIso());
    assert.equal(
      db.prepare("SELECT count(*) c FROM runs WHERE status IN ('queued','running')").get()!.c,
      1,
    );
    db.close();
  });

  test('done 상태는 여러 개 존재할 수 있다', () => {
    const db = openDb(':memory:');
    const ins = db.prepare(
      "INSERT INTO runs (id, trigger, status, created_at) VALUES (?, 'cron', 'done', ?)",
    );
    ins.run('r1', nowIso());
    ins.run('r2', nowIso());
    assert.equal(db.prepare('SELECT count(*) c FROM runs').get()!.c, 2);
    db.close();
  });

  test('FTS5 가상 테이블이 동작한다', () => {
    const db = openDb(':memory:');
    db.prepare(
      "INSERT INTO articles_fts(rowid, title, summary_ko, key_points, entities) VALUES (1, ?, ?, '', '')",
    ).run('vLLM 서빙', '추론 최적화 이야기');
    const hit = db.prepare("SELECT rowid FROM articles_fts WHERE articles_fts MATCH 'vLLM'").all();
    assert.equal(hit.length, 1);
    db.close();
  });

  test('migrate 를 두 번 불러도 안전하다', () => {
    const db = openDb(':memory:');
    assert.doesNotThrow(() => openDb(':memory:'));
    db.close();
  });

  test('tx 는 예외 시 롤백한다', () => {
    const db = openDb(':memory:');
    assert.throws(() =>
      tx(db, () => {
        db.prepare(
          "INSERT INTO feeds (url, name, seed_categories) VALUES ('http://a', 'A', '[]')",
        ).run();
        throw new Error('boom');
      }),
    );
    assert.equal(db.prepare('SELECT count(*) c FROM feeds').get()!.c, 0);
    db.close();
  });

  test('bool 헬퍼가 0/1 을 돌려준다', () => {
    assert.equal(bool(true), 1);
    assert.equal(bool(false), 0);
    assert.equal(bool(undefined), 0);
  });
});

describe('config', () => {
  test('기본값만으로 로드된다', () => {
    const cfg = loadConfig('존재하지-않는-경로.yaml');
    assert.equal(cfg.collect.backfill_limit, 20);
    assert.equal(cfg.llm.summarize_model, 'claude-haiku-4-5');
    assert.equal(cfg.server.port, 4321);
  });

  test('yaml 이 기본값을 덮어쓰고 나머지는 유지된다', () => {
    const d = tmp();
    const p = join(d, 'c.yaml');
    writeFileSync(p, 'llm:\n  concurrency: 2\ncollect:\n  backfill_limit: 5\n');
    const cfg = loadConfig(p);
    assert.equal(cfg.llm.concurrency, 2);
    assert.equal(cfg.collect.backfill_limit, 5);
    assert.equal(cfg.collect.max_articles_per_run, 200);
    assert.equal(cfg.llm.call_timeout_ms, 120000);
  });

  test('concurrency 상한 8 로 클램프된다', () => {
    const cfg = normalizeConfig(structuredClone({ ...DEFAULT_CONFIG }));
    cfg.llm.concurrency = 99;
    const out = normalizeConfig(cfg);
    assert.equal(out.llm.concurrency, MAX_LLM_CONCURRENCY);
    cfg.llm.concurrency = 0;
    assert.equal(normalizeConfig(cfg).llm.concurrency, 1);
  });

  test('시드 카테고리에 misc 가 항상 포함된다', () => {
    const cfg = loadConfig('없음.yaml');
    assert.ok(cfg.categories.seeds.includes('misc'));
  });

  test('mergeDeep 이 배열은 교체하고 객체는 재귀 병합한다', () => {
    const base = { a: { b: 1, c: 2 }, list: [1, 2, 3] };
    const out = mergeDeep(base, { a: { c: 9 }, list: [7] });
    assert.deepEqual(out, { a: { b: 1, c: 9 }, list: [7] });
  });

  test('feeds.yaml 을 읽는다', () => {
    const d = tmp();
    const p = join(d, 'feeds.yaml');
    writeFileSync(
      p,
      'feeds:\n  - url: https://a.example/feed.xml\n    name: A\n    seed_categories: [llm]\n  - url: https://b.example/feed.xml\n',
    );
    const feeds = loadFeeds(p);
    assert.equal(feeds.length, 2);
    assert.equal(feeds[0]!.name, 'A');
    assert.deepEqual(feeds[0]!.seed_categories, ['llm']);
    // name 이 없으면 호스트명으로 채운다
    assert.equal(feeds[1]!.name, 'b.example');
    assert.equal(feeds[1]!.enabled, true);
  });

  test('없는 feeds.yaml 은 빈 배열', () => {
    assert.deepEqual(loadFeeds('없음.yaml'), []);
  });
});

describe('log', () => {
  test('runId 를 주면 로그 파일에 남고 tailLog 로 읽힌다', () => {
    const d = tmp();
    setLevel('debug');
    const log = createLogger('테스트', 'run_x', d);
    log.info('첫 줄');
    log.warn('둘째 줄', { n: 1 });
    const lines = tailLog('run_x', 50, d);
    assert.equal(lines.length, 2);
    assert.ok(lines[0]!.includes('첫 줄'));
    assert.ok(lines[1]!.includes('{"n":1}'));
    setLevel('info');
  });

  test('없는 로그는 빈 배열', () => {
    assert.deepEqual(tailLog('run_없음', 50, tmp()), []);
  });
});

describe('types', () => {
  test('STAGES 가 PRD 파이프라인 순서다', () => {
    assert.deepEqual([...STAGES], [
      'collect',
      'extract',
      'dedupe',
      'enrich',
      'compose',
      'build',
    ]);
  });
});
