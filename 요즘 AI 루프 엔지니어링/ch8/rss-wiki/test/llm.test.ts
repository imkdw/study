import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildArgs, runClaude } from '../src/llm/claudeRunner.ts';
import { extractJsonBlock, validateEnrichResult } from '../src/llm/jsonSchema.ts';
import { runPool } from '../src/llm/pool.ts';
import { RateLimitError, UsageLimitError } from '../src/types.ts';
import type { SpawnImpl } from '../src/types.ts';

function okSpawnResult(json: unknown): { code: number; stdout: string; stderr: string } {
  return { code: 0, stdout: JSON.stringify(json), stderr: '' };
}

// ---------- extractJsonBlock ----------

test('extractJsonBlock: ```json 펜스 안의 객체를 추출한다', () => {
  const text = '설명입니다.\n```json\n{"a": 1, "b": "hi"}\n```\n끝.';
  assert.deepEqual(extractJsonBlock(text), { a: 1, b: 'hi' });
});

test('extractJsonBlock: 펜스가 없어도 균형 잡힌 객체를 찾는다', () => {
  const text = '앞에 잡설이 있고 {"x": 1, "y": [1, 2, 3]} 뒤에도 잡설이 있다.';
  assert.deepEqual(extractJsonBlock(text), { x: 1, y: [1, 2, 3] });
});

test('extractJsonBlock: 일반 ``` 펜스도 지원한다', () => {
  const text = '```\n{"only": true}\n```';
  assert.deepEqual(extractJsonBlock(text), { only: true });
});

test('extractJsonBlock: 중첩 객체를 올바르게 파싱한다', () => {
  const text = '```json\n{"a": {"b": {"c": 1}}, "d": "문자열 { 안에 중괄호 }"}\n```';
  assert.deepEqual(extractJsonBlock(text), { a: { b: { c: 1 } }, d: '문자열 { 안에 중괄호 }' });
});

test('extractJsonBlock: JSON 블록이 없으면 throw 한다', () => {
  assert.throws(() => extractJsonBlock('그냥 텍스트입니다. 죄송합니다.'));
});

// ---------- validateEnrichResult ----------

const seeds = ['llm', 'infra', 'frontend', 'misc'];

test('validateEnrichResult: one_liner_ko 80자 초과는 절삭한다', () => {
  const longLiner = '가'.repeat(100);
  const r = validateEnrichResult(
    {
      summary_ko: '요약입니다.',
      one_liner_ko: longLiner,
      category: 'llm',
      is_new_category: false,
      confidence: 0.9,
      key_points: [],
      entities: [],
    },
    seeds,
  );
  assert.equal(r.one_liner_ko.length, 80);
});

test('validateEnrichResult: key_points 는 3개까지만 남긴다', () => {
  const r = validateEnrichResult(
    {
      summary_ko: '요약입니다.',
      one_liner_ko: '한 줄 요약',
      category: 'llm',
      is_new_category: false,
      confidence: 0.5,
      key_points: ['a', 'b', 'c', 'd', 'e'],
      entities: [],
    },
    seeds,
  );
  assert.deepEqual(r.key_points, ['a', 'b', 'c']);
});

test('validateEnrichResult: confidence 를 0~1 로 클램프한다', () => {
  const over = validateEnrichResult(
    { summary_ko: 's', one_liner_ko: 'o', category: 'llm', is_new_category: false, confidence: 3.5, key_points: [], entities: [] },
    seeds,
  );
  assert.equal(over.confidence, 1);

  const under = validateEnrichResult(
    { summary_ko: 's', one_liner_ko: 'o', category: 'llm', is_new_category: false, confidence: -2, key_points: [], entities: [] },
    seeds,
  );
  assert.equal(under.confidence, 0);
});

test('validateEnrichResult: seeds 에 없는 category 는 is_new_category 를 강제로 true 로 만든다', () => {
  const r = validateEnrichResult(
    {
      summary_ko: 's',
      one_liner_ko: 'o',
      category: 'quantum-computing',
      is_new_category: false,
      confidence: 0.8,
      key_points: [],
      entities: [],
    },
    seeds,
  );
  assert.equal(r.is_new_category, true);
  assert.equal(r.category, 'quantum-computing');
});

test('validateEnrichResult: summary_ko 나 one_liner_ko 가 비어 있으면 throw', () => {
  assert.throws(() =>
    validateEnrichResult(
      { summary_ko: '   ', one_liner_ko: 'o', category: 'llm', is_new_category: false, confidence: 0.5, key_points: [], entities: [] },
      seeds,
    ),
  );
  assert.throws(() =>
    validateEnrichResult(
      { summary_ko: 's', one_liner_ko: '', category: 'llm', is_new_category: false, confidence: 0.5, key_points: [], entities: [] },
      seeds,
    ),
  );
});

// ---------- buildArgs ----------

test('buildArgs: --allowed-tools 빈 문자열과 --max-turns 1 을 포함한다', () => {
  const args = buildArgs('claude-haiku-4-5');
  assert.ok(args.includes('--allowed-tools'));
  assert.equal(args[args.indexOf('--allowed-tools') + 1], '');
  assert.ok(args.includes('--max-turns'));
  assert.equal(args[args.indexOf('--max-turns') + 1], '1');
  assert.ok(args.includes('-p'));
  assert.ok(args.includes('--model'));
  assert.equal(args[args.indexOf('--model') + 1], 'claude-haiku-4-5');
});

// ---------- runClaude ----------

test('runClaude: 정상 JSON 응답을 파싱한다', async () => {
  const spawnImpl: SpawnImpl = async () =>
    okSpawnResult({
      type: 'result',
      subtype: 'success',
      result: '요약 결과 텍스트',
      is_error: false,
      usage: { input_tokens: 100, output_tokens: 50 },
      total_cost_usd: 0.001,
    });

  const res = await runClaude('프롬프트', {
    bin: 'claude',
    model: 'claude-haiku-4-5',
    timeoutMs: 5000,
    spawnImpl,
  });

  assert.equal(res.text, '요약 결과 텍스트');
  assert.equal(res.usage.input_tokens, 100);
  assert.equal(res.usage.output_tokens, 50);
  assert.equal(res.usage.cost_usd, 0.001);
});

test('runClaude: is_error + rate limit 문자열 -> RateLimitError', async () => {
  const spawnImpl: SpawnImpl = async () =>
    okSpawnResult({ type: 'result', is_error: true, result: '429 rate limit exceeded' });

  await assert.rejects(
    runClaude('p', { bin: 'claude', model: 'm', timeoutMs: 5000, spawnImpl }),
    (err: unknown) => err instanceof RateLimitError,
  );
});

test('runClaude: usage limit 문자열 -> UsageLimitError', async () => {
  const spawnImpl: SpawnImpl = async () =>
    okSpawnResult({ type: 'result', is_error: true, result: 'daily usage limit reached' });

  await assert.rejects(
    runClaude('p', { bin: 'claude', model: 'm', timeoutMs: 5000, spawnImpl }),
    (err: unknown) => err instanceof UsageLimitError,
  );
});

test('runClaude: exit code 1 -> 일반 Error', async () => {
  const spawnImpl: SpawnImpl = async () => ({ code: 1, stdout: '', stderr: '알 수 없는 오류' });

  await assert.rejects(
    runClaude('p', { bin: 'claude', model: 'm', timeoutMs: 5000, spawnImpl }),
    (err: unknown) =>
      err instanceof Error &&
      !(err instanceof RateLimitError) &&
      !(err instanceof UsageLimitError),
  );
});

// ---------- runPool ----------

test('runPool: 동시 실행 수가 설정값을 넘지 않는다', async () => {
  let maxActive = 0;
  const items = Array.from({ length: 10 }, (_, i) => i);
  const worker = async (item: number) => {
    await new Promise((r) => setTimeout(r, 5));
    return item * 2;
  };

  const run = await runPool(items, worker, {
    concurrency: 3,
    backoffMs: [],
    onActive: (n) => {
      if (n > maxActive) maxActive = n;
    },
  });

  assert.ok(maxActive <= 3, `maxActive=${maxActive}`);
  assert.equal(run.results.length, 10);
  assert.ok(run.results.every((r) => r.ok));
});

test('runPool: 항목 하나가 throw 해도 나머지 전부 완료된다', async () => {
  const items = [1, 2, 3, 4, 5];
  const worker = async (item: number) => {
    if (item === 3) throw new Error('boom');
    return item;
  };

  const run = await runPool(items, worker, { concurrency: 2, backoffMs: [] });

  assert.equal(run.results.length, 5);
  const failed = run.results.filter((r) => !r.ok);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].item, 3);
  const ok = run.results.filter((r) => r.ok);
  assert.equal(ok.length, 4);
});

test('runPool: RateLimitError 재시도 후 성공한다', async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const worker = async () => {
    calls++;
    if (calls < 3) throw new RateLimitError('rate limited');
    return 'done';
  };

  const run = await runPool([1], worker, {
    concurrency: 1,
    backoffMs: [10, 20, 30],
    sleepImpl: async (ms) => {
      sleeps.push(ms);
    },
  });

  assert.equal(calls, 3);
  assert.equal(run.results.length, 1);
  assert.equal(run.results[0].ok, true);
  assert.deepEqual(sleeps, [10, 20]);
});

test('runPool: 연속 3회 rate limit -> effectiveConcurrency 가 절반으로 준다', async () => {
  const worker = async () => {
    throw new RateLimitError('rate limited');
  };

  const run = await runPool([1], worker, {
    concurrency: 4,
    backoffMs: [1, 1],
    sleepImpl: async () => {},
  });

  assert.equal(run.effectiveConcurrency, 2);
});

test('runPool: UsageLimitError -> stopped === "usage_limit", 남은 항목은 실행되지 않는다', async () => {
  let calls = 0;
  const items = [1, 2, 3, 4, 5];
  const worker = async (item: number) => {
    calls++;
    if (item === 2) throw new UsageLimitError('usage limit reached');
    await new Promise((r) => setTimeout(r, 20));
    return item;
  };

  const run = await runPool(items, worker, { concurrency: 1, backoffMs: [] });

  assert.equal(run.stopped, 'usage_limit');
  assert.ok(calls < items.length);
});

test('runPool: abort signal -> stopped === "cancelled"', async () => {
  const controller = new AbortController();
  const items = [1, 2, 3, 4, 5];
  const worker = async (item: number) => {
    if (item === 1) controller.abort();
    await new Promise((r) => setTimeout(r, 5));
    return item;
  };

  const run = await runPool(items, worker, { concurrency: 1, backoffMs: [], signal: controller.signal });

  assert.equal(run.stopped, 'cancelled');
});

test('runPool: 직렬 대비 빨라진다 (동시 4, 20개, 각 10ms)', async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const worker = async (item: number) => {
    await new Promise((r) => setTimeout(r, 10));
    return item;
  };

  const start = Date.now();
  const run = await runPool(items, worker, { concurrency: 4, backoffMs: [] });
  const elapsed = Date.now() - start;

  assert.equal(run.results.length, 20);
  assert.ok(elapsed < 100, `elapsed=${elapsed}ms (직렬 200ms 의 절반 미만이어야 함)`);
});
