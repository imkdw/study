/** 고정 크기 큐 소비자 워커 풀. 배치 단위 Promise.all 대기 방식은 쓰지 않는다. */
import { RateLimitError, UsageLimitError } from '../types.ts';

export interface PoolOptions {
  concurrency: number;
  maxConcurrency?: number;
  backoffMs: number[];
  signal?: AbortSignal;
  sleepImpl?: (ms: number) => Promise<void>;
  now?: () => number;
  onRateLimit?: (n: number) => void;
  /** 테스트 훅: 현재 동시에 실행 중인(워커 함수 안에 있는) 개수가 바뀔 때마다 호출된다. */
  onActive?: (n: number) => void;
}

export type PoolResult<T, R> =
  | { item: T; ok: true; value: R }
  | { item: T; ok: false; error: unknown };

export interface PoolRunResult<T, R> {
  results: PoolResult<T, R>[];
  stopped: 'usage_limit' | 'cancelled' | null;
  effectiveConcurrency: number;
}

const RESTORE_AFTER_MS = 5 * 60 * 1000;
const RATE_LIMIT_STREAK_TO_HALVE = 3;

type Outcome<T, R> =
  | { kind: 'done'; result: PoolResult<T, R> }
  | { kind: 'usage_limit' }
  | { kind: 'cancelled' };

export async function runPool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  opts: PoolOptions,
): Promise<PoolRunResult<T, R>> {
  const baseConcurrency = Math.max(1, Math.floor(opts.concurrency));
  const sleep = opts.sleepImpl ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = opts.now ?? (() => Date.now());

  let effectiveConcurrency = baseConcurrency;
  let consecutiveRateLimits = 0;
  let goodStreakStart: number | null = null;

  let stopped: 'usage_limit' | 'cancelled' | null = opts.signal?.aborted ? 'cancelled' : null;
  let activeConsumers = 0;
  let busy = 0;
  let nextIndex = 0;

  const resultMap = new Map<number, PoolResult<T, R>>();
  const running: Promise<void>[] = [];

  if (opts.signal && !opts.signal.aborted) {
    opts.signal.addEventListener('abort', () => {
      if (!stopped) stopped = 'cancelled';
    });
  }

  function onSuccess(): void {
    consecutiveRateLimits = 0;
    if (effectiveConcurrency < baseConcurrency) {
      if (goodStreakStart === null) {
        goodStreakStart = now();
      } else if (now() - goodStreakStart >= RESTORE_AFTER_MS) {
        effectiveConcurrency = baseConcurrency;
        goodStreakStart = null;
        trySpawn();
      }
    }
  }

  function onRateLimitHit(): void {
    consecutiveRateLimits++;
    opts.onRateLimit?.(consecutiveRateLimits);
    if (consecutiveRateLimits >= RATE_LIMIT_STREAK_TO_HALVE) {
      effectiveConcurrency = Math.max(1, Math.floor(effectiveConcurrency / 2));
      consecutiveRateLimits = 0;
      goodStreakStart = now();
    }
  }

  async function runOneWithRetry(item: T, index: number): Promise<Outcome<T, R>> {
    busy++;
    opts.onActive?.(busy);
    try {
      let attempt = 0;
      for (;;) {
        try {
          const value = await worker(item, index);
          onSuccess();
          return { kind: 'done', result: { item, ok: true, value } };
        } catch (err) {
          if (err instanceof UsageLimitError) {
            return { kind: 'usage_limit' };
          }
          if (err instanceof RateLimitError) {
            onRateLimitHit();
            if (attempt < opts.backoffMs.length) {
              const wait = opts.backoffMs[attempt];
              attempt++;
              await sleep(wait);
              if (opts.signal?.aborted) return { kind: 'cancelled' };
              continue;
            }
            return { kind: 'done', result: { item, ok: false, error: err } };
          }
          return { kind: 'done', result: { item, ok: false, error: err } };
        }
      }
    } finally {
      busy--;
      opts.onActive?.(busy);
    }
  }

  async function consumerLoop(): Promise<void> {
    for (;;) {
      if (stopped) break;
      if (activeConsumers > effectiveConcurrency) break; // 감속: 초과 소비자는 종료
      if (opts.signal?.aborted) {
        stopped = 'cancelled';
        break;
      }
      if (nextIndex >= items.length) break;

      const index = nextIndex++;
      const item = items[index];
      const outcome = await runOneWithRetry(item, index);

      if (outcome.kind === 'usage_limit') {
        stopped = 'usage_limit';
        break;
      }
      if (outcome.kind === 'cancelled') {
        stopped = 'cancelled';
        break;
      }
      resultMap.set(index, outcome.result);
      trySpawn(); // 복원 등으로 여유가 생겼으면 새 소비자를 채운다
    }
    activeConsumers--;
  }

  function trySpawn(): void {
    while (!stopped && activeConsumers < effectiveConcurrency && nextIndex < items.length) {
      activeConsumers++;
      running.push(consumerLoop());
    }
  }

  trySpawn();

  while (running.length > 0) {
    const batch = running.splice(0, running.length);
    await Promise.all(batch);
  }

  const results = Array.from(resultMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);

  return { results, stopped, effectiveConcurrency };
}
