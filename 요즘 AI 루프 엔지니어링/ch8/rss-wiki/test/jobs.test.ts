import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { openDb } from '../src/db/index.ts';
import type { Db } from '../src/db/index.ts';
import { runPipeline } from '../src/jobs/pipeline.ts';
import type { StageFns } from '../src/jobs/pipeline.ts';
import {
  ActiveRunError,
  createRun,
  getProgress,
  newRunId,
  reclaimStale,
  requestCancel,
  setRunStatus,
} from '../src/jobs/runs.ts';
import { STAGES } from '../src/types.ts';
import type { Logger } from '../src/util/log.ts';

function stubLogger(): Logger {
  return { debug() {}, info() {}, warn() {}, error() {} };
}

function okStages(overrides: Partial<StageFns> = {}): StageFns {
  return {
    collect: async () => ({ feedsOk: 1, feedsFailed: 0, articlesNew: 3 }),
    extract: async () => ({ ok: 3, failed: 0, fallback: 0 }),
    dedupe: async () => ({ clusters: 1, duplicates: 0 }),
    enrich: async () => ({
      ok: 3,
      failed: 0,
      partial: false,
      tokensIn: 10,
      tokensOut: 20,
      costUsd: 0.01,
    }),
    compose: async () => ({ pagesUpdated: 1, rewritten: 0, archived: 0 }),
    build: async () => ({ pages: 1, indexBytes: 10, reduced: false }),
    ...overrides,
  };
}

function freshDb(): Db {
  return openDb(':memory:');
}

test('createRun 두 번 연속이면 두 번째는 ActiveRunError 를 던지고 기존 runId 를 담는다', () => {
  const db = freshDb();
  const id1 = createRun(db, 'manual');

  assert.throws(
    () => createRun(db, 'manual'),
    (err: unknown) => {
      assert.ok(err instanceof ActiveRunError);
      assert.strictEqual((err as ActiveRunError).runId, id1);
      return true;
    },
  );
});

test('첫 run 을 done 으로 끝내면 새 run 이 만들어진다', () => {
  const db = freshDb();
  const id1 = createRun(db, 'manual');
  setRunStatus(db, id1, 'done');

  const id2 = createRun(db, 'manual');
  assert.notStrictEqual(id1, id2);
});

test('reclaimStale: heartbeat 이 오래된 running 잡은 stale 이 되고 이후 새 run 생성이 성공한다', () => {
  const db = freshDb();
  const runId = createRun(db, 'manual');
  setRunStatus(db, runId, 'running');

  const old = new Date(Date.now() - 70_000).toISOString();
  db.prepare('UPDATE runs SET heartbeat_at = ? WHERE id = ?').run(old, runId);

  const reclaimed = reclaimStale(db, 60_000);
  assert.strictEqual(reclaimed, 1);

  const progress = getProgress(db, runId);
  assert.strictEqual(progress?.status, 'stale');

  const newId = createRun(db, 'manual');
  assert.ok(newId);
  assert.notStrictEqual(newId, runId);
});

test('getProgress 페이로드가 PRD 구조를 만족한다', () => {
  const db = freshDb();
  const runId = createRun(db, 'manual');
  const progress = getProgress(db, runId);

  assert.ok(progress);
  assert.strictEqual(progress.runId, runId);
  assert.strictEqual(progress.status, 'queued');
  assert.ok('stage' in progress);
  assert.ok('startedAt' in progress);
  assert.ok('errors' in progress);
  for (const stage of STAGES) {
    assert.ok(progress.stages[stage], `stage ${stage} 가 존재해야 한다`);
    assert.ok(progress.stages[stage].status);
  }
  assert.strictEqual(typeof progress.elapsedMs, 'number');
  assert.ok(!Number.isNaN(progress.elapsedMs));
});

test('runPipeline 이 가짜 StageFns 로 6단계를 순서대로 실행하고 최종 done', async () => {
  const db = freshDb();
  const runId = createRun(db, 'manual');
  const calls: string[] = [];
  const stages = okStages({
    collect: async () => {
      calls.push('collect');
      return { feedsOk: 1, feedsFailed: 0, articlesNew: 3 };
    },
    extract: async () => {
      calls.push('extract');
      return { ok: 3, failed: 0, fallback: 0 };
    },
    dedupe: async () => {
      calls.push('dedupe');
      return { clusters: 1, duplicates: 0 };
    },
    enrich: async () => {
      calls.push('enrich');
      return { ok: 3, failed: 0, partial: false, tokensIn: 10, tokensOut: 20, costUsd: 0.01 };
    },
    compose: async () => {
      calls.push('compose');
      return { pagesUpdated: 1, rewritten: 0, archived: 0 };
    },
    build: async () => {
      calls.push('build');
      return { pages: 1, indexBytes: 10, reduced: false };
    },
  });

  const progress = await runPipeline({ db, cfg: DEFAULT_CONFIG, runId, log: stubLogger(), stages });

  assert.deepStrictEqual(calls, [...STAGES]);
  assert.strictEqual(progress.status, 'done');
  for (const stage of STAGES) assert.strictEqual(progress.stages[stage].status, 'done');
});

test('enrich 가 partial: true 를 반환하면 최종 status 는 partial', async () => {
  const db = freshDb();
  const runId = createRun(db, 'manual');
  const stages = okStages({
    enrich: async () => ({
      ok: 2,
      failed: 1,
      partial: true,
      tokensIn: 5,
      tokensOut: 5,
      costUsd: 0.001,
    }),
  });

  const progress = await runPipeline({ db, cfg: DEFAULT_CONFIG, runId, log: stubLogger(), stages });
  assert.strictEqual(progress.status, 'partial');
});

test('compose 가 throw 하면 최종 status 는 failed, 해당 stage 에 error 기록', async () => {
  const db = freshDb();
  const runId = createRun(db, 'manual');
  const stages = okStages({
    compose: async () => {
      throw new Error('compose boom');
    },
  });

  const progress = await runPipeline({ db, cfg: DEFAULT_CONFIG, runId, log: stubLogger(), stages });

  assert.strictEqual(progress.status, 'failed');
  assert.strictEqual(progress.stages.compose.status, 'failed');
  assert.strictEqual(progress.stages.compose.error, 'compose boom');
  assert.strictEqual(progress.stages.build.status, 'pending');
});

test('취소: requestCancel 후 다음 스테이지 경계에서 멈추고 status cancelled, 남은 스테이지는 pending', async () => {
  const db = freshDb();
  const runId = createRun(db, 'manual');
  const stages = okStages({
    collect: async () => {
      requestCancel(db, runId);
      return { feedsOk: 1, feedsFailed: 0, articlesNew: 3 };
    },
  });

  const progress = await runPipeline({ db, cfg: DEFAULT_CONFIG, runId, log: stubLogger(), stages });

  assert.strictEqual(progress.status, 'cancelled');
  assert.strictEqual(progress.stages.collect.status, 'done');
  assert.strictEqual(progress.stages.extract.status, 'pending');
  assert.strictEqual(progress.stages.dedupe.status, 'pending');
  assert.strictEqual(progress.stages.enrich.status, 'pending');
  assert.strictEqual(progress.stages.compose.status, 'pending');
  assert.strictEqual(progress.stages.build.status, 'pending');
});

test('heartbeat 이 실행 중 갱신된다', async () => {
  const db = freshDb();
  const runId = createRun(db, 'manual');
  const before = (
    db.prepare('SELECT heartbeat_at FROM runs WHERE id = ?').get(runId) as { heartbeat_at: string }
  ).heartbeat_at;

  await sleep(5);

  const stages = okStages({
    collect: async () => {
      await sleep(60);
      return { feedsOk: 1, feedsFailed: 0, articlesNew: 0 };
    },
  });

  await runPipeline({ db, cfg: DEFAULT_CONFIG, runId, log: stubLogger(), stages, heartbeatMs: 15 });

  const after = (
    db.prepare('SELECT heartbeat_at FROM runs WHERE id = ?').get(runId) as { heartbeat_at: string }
  ).heartbeat_at;

  assert.notStrictEqual(after, before);
});

test('newRunId 는 시간순 정렬 가능하고 유일하다', async () => {
  const a = newRunId();
  await sleep(5);
  const b = newRunId();
  assert.ok(b > a, '나중에 만든 id 가 사전순으로 더 커야 한다');

  const ids = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const id = newRunId();
    assert.match(id, /^run_[0-9A-HJKMNP-TV-Z]{26}$/);
    ids.add(id);
  }
  assert.strictEqual(ids.size, 1000);
});
