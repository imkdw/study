/** enrich 스테이지: claude -p 워커 풀로 글을 요약/분류하고 DB 에 기록한다. */
import { bool, nowIso, tx } from '../db/index.ts';
import { CancelledError, ctxNow, throwIfCancelled } from '../stage.ts';
import type { StageCtx } from '../stage.ts';
import {
  LlmTimeoutError,
  RateLimitError,
  UsageLimitError,
} from '../types.ts';
import type { ClaudeUsage, EnrichResult, FailedReason, SpawnImpl } from '../types.ts';
import { runClaude } from '../llm/claudeRunner.ts';
import { extractJsonBlock, validateEnrichResult } from '../llm/jsonSchema.ts';
import { summarizePrompt } from '../llm/prompts.ts';
import { runPool } from '../llm/pool.ts';
import { addUsage, getUsage } from '../util/budget.ts';
import { nextRetryAt } from '../util/retry.ts';
import { reindexFts } from '../search/fts.ts';
import { ensureSeedCategories, resolveCategory } from './categories.ts';

/** 거절 응답: 정상 JSON 이 아니라 사람이 읽는 거절 문장을 돌려준 경우 */
class RefusalError extends Error {
  readonly kind = 'llm_refusal' as const;
}

/** 1회 재시도까지 실패한 JSON 파싱 오류 */
class ParseFailureError extends Error {
  readonly kind = 'parse' as const;
}

interface ArticleTask {
  id: number;
  title: string;
  url: string;
  raw_content: string | null;
  retry_count: number;
  feed_name: string;
}

export interface EnrichSummary {
  ok: number;
  failed: number;
  /** 예산 초과나 취소로 호출 자체가 중단된 글 수. 실패가 아니므로 재시도 카운트를 쓰지 않는다. */
  interrupted: number;
  partial: boolean;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

const REFUSAL_MARKERS = ['죄송', 'cannot', "can't help"];

export async function enrich(ctx: StageCtx & { spawnImpl?: SpawnImpl }): Promise<EnrichSummary> {
  throwIfCancelled(ctx);
  const cfg = ctx.cfg;

  ensureSeedCategories(ctx.db, cfg.categories.seeds);

  const now0 = ctxNow(ctx);
  let runningCostUsd = getUsage(ctx.db, now0).cost_usd;

  if (runningCostUsd >= cfg.llm.daily_budget_usd) {
    return { ok: 0, failed: 0, interrupted: 0, partial: true, tokensIn: 0, tokensOut: 0, costUsd: 0 };
  }

  const rows = ctx.db
    .prepare(
      `SELECT a.id AS id, a.title AS title, a.url AS url, a.raw_content AS raw_content,
              a.retry_count AS retry_count, f.name AS feed_name
       FROM articles a
       JOIN feeds f ON f.id = a.feed_id
       LEFT JOIN clusters c ON a.cluster_id = c.id
       WHERE a.status = 'fetched'
         AND (a.cluster_id IS NULL OR c.canonical_article_id = a.id)
       ORDER BY a.id ASC`,
    )
    .all() as unknown as ArticleTask[];

  const total = rows.length;
  if (total === 0) {
    return { ok: 0, failed: 0, interrupted: 0, partial: false, tokensIn: 0, tokensOut: 0, costUsd: 0 };
  }

  const budgetController = new AbortController();
  const combinedSignal = ctx.signal ? AbortSignal.any([ctx.signal, budgetController.signal]) : budgetController.signal;

  let budgetExceeded = false;
  let done = 0;
  let okCount = 0;
  let failedCount = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;

  // 예산 선반영: 이미 떠 있는 호출이 얼마를 쓸지 모르므로 관측 평균으로 잡아 둔다.
  // 이렇게 해야 동시 실행 수만큼 예산을 초과하고 나서야 멈추는 일이 없다.
  let inFlight = 0;
  let observedCalls = 0;
  let avgCostUsd = 0;

  function projectedCostUsd(): number {
    return runningCostUsd + inFlight * avgCostUsd;
  }

  /**
   * 예산/취소로 중단된 글은 실패가 아니다. 상태와 retry_count 를 그대로 둬서
   * 다음 사이클이 다시 집어 간다 (PRD 9.2). 집계는 마지막에 total - 처리분 으로 낸다.
   */
  function markInterrupted(): void {
    /* 상태를 건드리지 않는 것이 처리의 전부다 */
  }

  function classify(err: unknown): FailedReason {
    if (err instanceof LlmTimeoutError) return 'timeout';
    if (err instanceof RefusalError) return 'llm_refusal';
    if (err instanceof ParseFailureError) return 'parse';
    return 'llm_error';
  }

  function markFailure(task: ArticleTask, reason: FailedReason): void {
    tx(ctx.db, () => {
      const now = nowIso();
      const row = ctx.db.prepare('SELECT retry_count FROM articles WHERE id = ?').get(task.id) as {
        retry_count: number;
      };

      if (reason === 'parse') {
        // JSON 파싱은 재시도(1회) 이후 실패하면 retry_count 와 무관하게 바로 dead_letter 로 보낸다.
        ctx.db
          .prepare(
            `UPDATE articles SET status = 'dead_letter', retry_count = ?, failed_reason = ?, updated_at = ? WHERE id = ?`,
          )
          .run(row.retry_count + 1, reason, now, task.id);
        return;
      }

      const nextRetryCount = row.retry_count + 1;
      const isDeadLetter = nextRetryCount >= cfg.retry.max_attempts;
      const status = isDeadLetter ? 'dead_letter' : 'failed';
      const nextRetry = isDeadLetter ? null : nextRetryAt(nextRetryCount, cfg.retry.backoff_ms, ctxNow(ctx));
      ctx.db
        .prepare(
          `UPDATE articles SET status = ?, retry_count = ?, failed_reason = ?, next_retry_at = ?, updated_at = ? WHERE id = ?`,
        )
        .run(status, nextRetryCount, reason, nextRetry, now, task.id);
    });
    failedCount++;
    done++;
    ctx.onProgress?.('enrich', done, total);
  }

  function commitSuccess(task: ArticleTask, result: EnrichResult, usage: ClaudeUsage): void {
    tx(ctx.db, () => {
      const now = nowIso();
      ctx.db
        .prepare(
          `INSERT INTO summaries
             (article_id, summary_ko, one_liner_ko, key_points_json, entities_json, model, input_tokens, output_tokens, cost_usd, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(article_id) DO UPDATE SET
             summary_ko = excluded.summary_ko,
             one_liner_ko = excluded.one_liner_ko,
             key_points_json = excluded.key_points_json,
             entities_json = excluded.entities_json,
             model = excluded.model,
             input_tokens = excluded.input_tokens,
             output_tokens = excluded.output_tokens,
             cost_usd = excluded.cost_usd,
             created_at = excluded.created_at`,
        )
        .run(
          task.id,
          result.summary_ko,
          result.one_liner_ko,
          JSON.stringify(result.key_points),
          JSON.stringify(result.entities),
          cfg.llm.summarize_model,
          usage.input_tokens,
          usage.output_tokens,
          usage.cost_usd,
          now,
        );

      const { categoryId, needsReview } = resolveCategory(ctx.db, result, cfg);
      ctx.db
        .prepare(
          `INSERT INTO article_categories (article_id, category_id, confidence, needs_review)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(article_id, category_id) DO UPDATE SET
             confidence = excluded.confidence,
             needs_review = excluded.needs_review`,
        )
        .run(task.id, categoryId, result.confidence, bool(needsReview));

      ctx.db.prepare(`UPDATE articles SET status = 'summarized', updated_at = ? WHERE id = ?`).run(now, task.id);

      addUsage(
        ctx.db,
        { tokensIn: usage.input_tokens, tokensOut: usage.output_tokens, costUsd: usage.cost_usd },
        ctxNow(ctx),
      );
    });
  }

  async function processOne(task: ArticleTask): Promise<{ result: EnrichResult; usage: ClaudeUsage }> {
    const prompt = summarizePrompt({
      title: task.title,
      url: task.url,
      feedName: task.feed_name,
      content: task.raw_content ?? '',
      seeds: cfg.categories.seeds,
      language: cfg.llm.language,
    });

    const runOpts = {
      bin: cfg.llm.claude_bin,
      model: cfg.llm.summarize_model,
      timeoutMs: cfg.llm.call_timeout_ms,
      signal: combinedSignal,
      spawnImpl: ctx.spawnImpl,
    };

    const resp = await runClaude(prompt, runOpts);

    const lowerText = resp.text.toLowerCase();
    if (REFUSAL_MARKERS.some((m) => lowerText.includes(m))) {
      throw new RefusalError('LLM 이 요청을 거절했습니다');
    }

    let usage = resp.usage;
    try {
      const block = extractJsonBlock(resp.text);
      const result = validateEnrichResult(block, cfg.categories.seeds);
      return { result, usage };
    } catch {
      // JSON 파싱 실패: "JSON 만 출력" 강조 문구를 덧붙여 1회만 재시도한다.
      const retryPrompt = `${prompt}\n\n중요: 반드시 JSON 객체 하나만 출력하라. 다른 문장을 절대 포함하지 마라.`;
      const resp2 = await runClaude(retryPrompt, runOpts);
      usage = {
        input_tokens: usage.input_tokens + resp2.usage.input_tokens,
        output_tokens: usage.output_tokens + resp2.usage.output_tokens,
        cost_usd: usage.cost_usd + resp2.usage.cost_usd,
      };
      try {
        const block2 = extractJsonBlock(resp2.text);
        const result = validateEnrichResult(block2, cfg.categories.seeds);
        return { result, usage };
      } catch {
        throw new ParseFailureError('JSON 파싱에 재시도 후에도 실패했습니다');
      }
    }
  }

  async function worker(task: ArticleTask): Promise<void> {
    // 이미 중단된 뒤라면 호출 자체를 시작하지 않는다.
    if (combinedSignal.aborted) {
      markInterrupted();
      return;
    }

    // 예산 선반영 검사: 떠 있는 호출의 예상 비용까지 더해서 넘으면 새 호출을 시작하지 않는다.
    if (projectedCostUsd() >= cfg.llm.daily_budget_usd) {
      budgetExceeded = true;
      budgetController.abort();
      markInterrupted();
      return;
    }

    let outcome: { result: EnrichResult; usage: ClaudeUsage };
    inFlight++;
    try {
      outcome = await processOne(task);
    } catch (err) {
      if (err instanceof RateLimitError || err instanceof UsageLimitError) {
        // 풀이 재시도/중단을 담당한다.
        throw err;
      }
      // 예산 초과나 취소로 자식 프로세스를 죽여서 난 오류는 글의 실패가 아니다.
      // 상태와 retry_count 를 건드리지 않고 그대로 둔다 (PRD 9.2).
      if (combinedSignal.aborted) {
        markInterrupted();
        return;
      }
      markFailure(task, classify(err));
      return;
    } finally {
      inFlight--;
    }

    commitSuccess(task, outcome.result, outcome.usage);
    tokensIn += outcome.usage.input_tokens;
    tokensOut += outcome.usage.output_tokens;
    costUsd += outcome.usage.cost_usd;
    runningCostUsd += outcome.usage.cost_usd;
    okCount++;
    done++;
    ctx.onProgress?.('enrich', done, total);

    observedCalls++;
    avgCostUsd = (avgCostUsd * (observedCalls - 1) + outcome.usage.cost_usd) / observedCalls;

    if (projectedCostUsd() >= cfg.llm.daily_budget_usd) {
      budgetExceeded = true;
      budgetController.abort();
    }
  }

  const poolRun = await runPool(rows, (task) => worker(task), {
    concurrency: cfg.llm.concurrency,
    backoffMs: cfg.llm.backoff_on_rate_limit_ms,
    signal: combinedSignal,
  });

  // 레이트리밋 재시도가 모두 소진되어 풀 내부에서 바로 실패 처리된 항목들
  for (const r of poolRun.results) {
    if (r.ok) continue;
    if (combinedSignal.aborted) {
      markInterrupted();
      continue;
    }
    markFailure(r.item, classify(r.error));
  }

  // 시작도 못 한 글까지 포함해서 중단된 글 수를 센다.
  // (풀은 중단 시 남은 항목을 아예 집지 않으므로 결과 배열에도 안 나온다)
  const interruptedCount = Math.max(0, total - okCount - failedCount);
  const partial = budgetExceeded || poolRun.stopped === 'usage_limit' || interruptedCount > 0;

  if (ctx.signal?.aborted) {
    throw new CancelledError();
  }

  // 새 요약이 생겼으면 검색 인덱스를 여기서 갱신한다.
  // build 를 돌리지 않아도 `rss-wiki search` 가 바로 최신 결과를 주도록.
  if (okCount > 0) {
    try {
      reindexFts(ctx.db);
    } catch (e) {
      ctx.log.warn('검색 인덱스 갱신 실패', { error: (e as Error).message });
    }
  }

  if (budgetExceeded) {
    ctx.log.warn('일일 예산을 초과해 요약을 중단했다', {
      budgetUsd: cfg.llm.daily_budget_usd,
      spentUsd: Number(runningCostUsd.toFixed(4)),
      interrupted: interruptedCount,
    });
  }

  return {
    ok: okCount,
    failed: failedCount,
    interrupted: interruptedCount,
    partial,
    tokensIn,
    tokensOut,
    costUsd,
  };
}
