import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { openDb } from '../src/db/index.ts';
import type { Db } from '../src/db/index.ts';
import type { StageFns } from '../src/jobs/pipeline.ts';
import { JobWorker } from '../src/jobs/worker.ts';
import { serve } from '../src/server/index.ts';
import type { AppConfig } from '../src/types.ts';

/** 각 스테이지가 약간의 시간이 걸리는 가짜 StageFns. 취소 확인을 위해 requestCancel 훅을 준다. */
function slowStages(stageMs = 60): StageFns {
  const wait = () => sleep(stageMs);
  return {
    collect: async () => {
      await wait();
      return { feedsOk: 1, feedsFailed: 0, articlesNew: 1 };
    },
    extract: async () => {
      await wait();
      return { ok: 1, failed: 0, fallback: 0 };
    },
    dedupe: async () => {
      await wait();
      return { clusters: 1, duplicates: 0 };
    },
    enrich: async () => {
      await wait();
      return { ok: 1, failed: 0, partial: false, tokensIn: 1, tokensOut: 1, costUsd: 0 };
    },
    compose: async () => {
      await wait();
      return { pagesUpdated: 1, rewritten: 0, archived: 0 };
    },
    build: async () => {
      await wait();
      return { pages: 1, indexBytes: 1, reduced: false };
    },
  };
}

function testCfg(overrides: Partial<AppConfig['server']> = {}, distDir?: string): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    server: { ...DEFAULT_CONFIG.server, port: 0, host: '127.0.0.1', ...overrides },
    build: { ...DEFAULT_CONFIG.build, out_dir: distDir ?? DEFAULT_CONFIG.build.out_dir },
  };
}

async function withServer(
  opts: { db?: Db; cfg?: AppConfig; distDir?: string; stageMs?: number } = {},
  fn: (ctx: { url: string; db: Db; cfg: AppConfig }) => Promise<void>,
): Promise<void> {
  const db = opts.db ?? openDb(':memory:');
  const cfg = opts.cfg ?? testCfg({}, opts.distDir);
  const worker = new JobWorker({ db, cfg, stages: slowStages(opts.stageMs ?? 60) });
  const { url, close } = await serve({ db, cfg, worker, distDir: opts.distDir });
  try {
    await fn({ url, db, cfg });
  } finally {
    await close();
  }
}

test('POST /api/runs 는 200ms 이내에 202 + runId 를 준다', async () => {
  await withServer({ stageMs: 300 }, async ({ url }) => {
    const t0 = Date.now();
    const res = await fetch(`${url}/api/runs`, { method: 'POST' });
    const elapsed = Date.now() - t0;
    const body = (await res.json()) as { runId: string; status: string };

    assert.strictEqual(res.status, 202);
    assert.ok(body.runId);
    assert.strictEqual(body.status, 'queued');
    assert.ok(elapsed < 200, `${elapsed}ms 걸렸다`);
  });
});

test('실행 중에 다시 POST /api/runs 하면 409 + 같은 runId', async () => {
  await withServer({ stageMs: 300 }, async ({ url }) => {
    const first = await fetch(`${url}/api/runs`, { method: 'POST' });
    const firstBody = (await first.json()) as { runId: string };

    const second = await fetch(`${url}/api/runs`, { method: 'POST' });
    const secondBody = (await second.json()) as { runId: string; status: string };

    assert.strictEqual(second.status, 409);
    assert.strictEqual(secondBody.runId, firstBody.runId);
  });
});

test('GET /api/runs/:id 폴링이 진행 상황을 준다', async () => {
  await withServer({ stageMs: 150 }, async ({ url }) => {
    const created = await fetch(`${url}/api/runs`, { method: 'POST' });
    const { runId } = (await created.json()) as { runId: string };

    const res = await fetch(`${url}/api/runs/${runId}`);
    const body = (await res.json()) as { runId: string; stages: Record<string, unknown> };

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.runId, runId);
    assert.ok(body.stages);
  });
});

test('SSE 가 최소 1개 이상의 data 이벤트와 종료 이벤트를 보낸다', async () => {
  await withServer({ stageMs: 50 }, async ({ url }) => {
    const created = await fetch(`${url}/api/runs`, { method: 'POST' });
    const { runId } = (await created.json()) as { runId: string };

    const res = await fetch(`${url}/api/runs/${runId}/stream`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/event-stream'));

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let dataEvents = 0;
    let sawDone = false;

    while (!sawDone) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes('data:')) dataEvents += 1;
      if (buffer.includes('event: done')) sawDone = true;
      buffer = '';
    }

    assert.ok(dataEvents >= 1);
    assert.ok(sawDone);
  });
});

test('POST /api/runs/:id/cancel 은 202 이고 결국 status 가 cancelled', async () => {
  await withServer({ stageMs: 300 }, async ({ url }) => {
    const created = await fetch(`${url}/api/runs`, { method: 'POST' });
    const { runId } = (await created.json()) as { runId: string };

    const cancelRes = await fetch(`${url}/api/runs/${runId}/cancel`, { method: 'POST' });
    const cancelBody = (await cancelRes.json()) as { runId: string; cancelRequested: boolean };
    assert.strictEqual(cancelRes.status, 202);
    assert.strictEqual(cancelBody.cancelRequested, true);

    let status = '';
    for (let i = 0; i < 50; i++) {
      const res = await fetch(`${url}/api/runs/${runId}`);
      const body = (await res.json()) as { status: string };
      status = body.status;
      if (status === 'cancelled') break;
      await sleep(50);
    }
    assert.strictEqual(status, 'cancelled');
  });
});

test('GET /api/runs?limit=5 가 배열을 준다', async () => {
  await withServer({ stageMs: 20 }, async ({ url, db }) => {
    const created = await fetch(`${url}/api/runs`, { method: 'POST' });
    await created.json();

    const res = await fetch(`${url}/api/runs?limit=5`);
    const body = (await res.json()) as unknown[];
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(body));
    assert.ok(body.length >= 1);
    void db;
  });
});

test('정적 파일 서빙: distDir 의 index.html 을 GET / 로 받는다', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rss-wiki-dist-'));
  writeFileSync(join(dir, 'index.html'), '<html><body>hi</body></html>');
  try {
    await withServer({ distDir: dir, stageMs: 20 }, async ({ url }) => {
      const res = await fetch(`${url}/`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/html'));
      const text = await res.text();
      assert.ok(text.includes('hi'));
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('경로 탈출은 403/404 로 막힌다', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rss-wiki-dist-'));
  writeFileSync(join(dir, 'index.html'), '<html></html>');
  try {
    await withServer({ distDir: dir, stageMs: 20 }, async ({ url }) => {
      const res = await fetch(`${url}/../../../../../../etc/passwd`);
      assert.ok(res.status === 403 || res.status === 404, `status=${res.status}`);

      const res2 = await fetch(`${url}/%2e%2e/%2e%2e/%2e%2e/etc/passwd`);
      assert.ok(res2.status === 403 || res2.status === 404, `status=${res2.status}`);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('enable_manual_run 이 false 면 POST /api/runs 가 403', async () => {
  const cfg = testCfg({ enable_manual_run: false });
  await withServer({ cfg, stageMs: 20 }, async ({ url }) => {
    const res = await fetch(`${url}/api/runs`, { method: 'POST' });
    assert.strictEqual(res.status, 403);
  });
});
