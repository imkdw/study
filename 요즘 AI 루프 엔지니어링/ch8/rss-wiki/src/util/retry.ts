/** 재시도 정책: 에러 분류, 백오프 스케줄, dead_letter 격리, 범용 재시도 래퍼. */

import { nowIso } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import type { AppConfig, ArticleStatus, FailedReason } from '../types.ts';

/** 에러 메시지/이름으로 실패 사유를 분류한다. */
export function classifyError(e: unknown): FailedReason {
  const name = e instanceof Error ? e.name : '';
  const message = e instanceof Error ? e.message : String(e);
  const text = `${name} ${message}`;

  if (/AbortError|TimeoutError|timeout/i.test(text)) return 'timeout';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|HTTP\s*5\d\d|status\s*5\d\d/i.test(text)) {
    return 'network';
  }
  if (/JSON|parse|Unexpected token/i.test(text)) return 'parse';
  if (/rate limit|usage/i.test(text)) return 'llm_error';
  if (/죄송|cannot help/i.test(text)) return 'llm_refusal';
  return 'llm_error';
}

/**
 * 다음 재시도 시각을 계산한다.
 * retryCount 는 이번 실패까지 포함한 횟수다 (1부터 시작).
 * backoffMs 범위를 넘어서면 더 이상 재시도하지 않는다는 뜻으로 null 을 돌려준다.
 */
export function nextRetryAt(retryCount: number, backoffMs: number[], now: Date): string | null {
  const idx = retryCount - 1;
  if (idx < 0 || idx >= backoffMs.length) return null;
  return new Date(now.getTime() + backoffMs[idx]).toISOString();
}

interface RetryRow {
  retry_count: number;
}

/** 글 처리 실패를 기록한다. 최대 재시도 횟수를 넘기면 dead_letter 로 격리한다. */
export function recordFailure(
  db: Db,
  articleId: number,
  e: unknown,
  cfg: AppConfig,
  now: Date = new Date(),
): { status: ArticleStatus; reason: FailedReason; retryCount: number } {
  const row = db.prepare('SELECT retry_count FROM articles WHERE id = ?').get(articleId) as
    | RetryRow
    | undefined;
  const retryCount = (row?.retry_count ?? 0) + 1;
  const reason = classifyError(e);
  const isDeadLetter = retryCount >= cfg.retry.max_attempts;
  const status: ArticleStatus = isDeadLetter ? 'dead_letter' : 'failed';
  const nextRetry = isDeadLetter ? null : nextRetryAt(retryCount, cfg.retry.backoff_ms, now);

  db.prepare(
    `UPDATE articles
     SET status = ?, retry_count = ?, next_retry_at = ?, failed_reason = ?, updated_at = ?
     WHERE id = ?`,
  ).run(status, retryCount, nextRetry, reason, nowIso(), articleId);

  return { status, reason, retryCount };
}

interface DueRow {
  id: number;
}

/** 지금 재시도해도 되는 (next_retry_at 이 지난) failed 글 id 목록. */
export function dueForRetry(db: Db, now: Date = new Date()): number[] {
  const rows = db
    .prepare(
      `SELECT id FROM articles
       WHERE status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= ?
       ORDER BY id`,
    )
    .all(now.toISOString()) as unknown as DueRow[];
  return rows.map((r) => r.id);
}

/** 재시도 대상을 discovered 로 되돌린다. retry_count 는 유지한다. */
export function resetForRetry(db: Db, ids: number[]): void {
  if (ids.length === 0) return;
  const stmt = db.prepare(
    `UPDATE articles SET status = 'discovered', next_retry_at = NULL, updated_at = ? WHERE id = ?`,
  );
  const ts = nowIso();
  for (const id of ids) stmt.run(ts, id);
}

export interface WithRetryOptions {
  attempts: number;
  backoffMs: number[];
  sleepImpl?: (ms: number) => Promise<void>;
  shouldRetry?: (e: unknown) => boolean;
}

/** 지수 백오프 재시도 래퍼. shouldRetry 가 false 를 돌려주면 즉시 던진다. */
export async function withRetry<T>(fn: () => Promise<T>, opts: WithRetryOptions): Promise<T> {
  const sleep = opts.sleepImpl ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastError: unknown;

  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (opts.shouldRetry && !opts.shouldRetry(e)) throw e;
      if (attempt === opts.attempts - 1) throw e;
      const wait = opts.backoffMs[attempt] ?? opts.backoffMs[opts.backoffMs.length - 1] ?? 0;
      await sleep(wait);
    }
  }

  throw lastError;
}
