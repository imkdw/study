/**
 * compose 전체 재작성용 RewriteFn 구성기.
 * claude -p 를 rewrite_model 로 호출해 "지금까지의 흐름" / 관련 주제 / 이번 주 하이라이트를 다시 쓴다.
 * 예산 가드와 취소 신호를 존중하고, 실패하면 throw 해서 compose 가 직전 파일을 유지하게 한다.
 */
import type { RewriteFn } from '../compose/index.ts';
import type { StageCtx } from '../stage.ts';
import type { PageData, SpawnImpl } from '../types.ts';
import { ctxNow } from '../stage.ts';
import { addUsage, getUsage } from '../util/budget.ts';
import { runClaude } from './claudeRunner.ts';
import { extractJsonBlock, validateRewriteResult } from './jsonSchema.ts';
import { rewritePagePrompt } from './prompts.ts';

/** 재작성 프롬프트에 넣을 타임라인 마크다운. 최근 항목만 넣어 프롬프트를 짧게 유지한다. */
function timelineMarkdown(page: PageData, limit = 30): string {
  const items = page.timeline.slice(0, limit);
  if (items.length === 0) return '(아직 항목이 없다)';
  return items
    .map((it) => `- ${it.date} / ${it.title} / ${it.one_liner}`)
    .join('\n');
}

export class BudgetExceededError extends Error {
  readonly kind = 'budget_exceeded' as const;
}

/**
 * 재작성 함수를 만든다. 예산이 이미 소진됐으면 null 을 돌려주고,
 * 이 경우 compose 는 재작성 없이 증분 갱신만 한다.
 */
export function createRewriteFn(
  ctx: StageCtx & { spawnImpl?: SpawnImpl },
): RewriteFn | null {
  const { cfg, db, log } = ctx;

  if (getUsage(db, ctxNow(ctx)).cost_usd >= cfg.llm.daily_budget_usd) {
    log.warn('일일 예산이 소진되어 위키 재작성을 건너뛴다', {
      budgetUsd: cfg.llm.daily_budget_usd,
    });
    return null;
  }

  return async (page: PageData) => {
    if (ctx.signal?.aborted) throw new Error('cancelled');

    if (getUsage(db, ctxNow(ctx)).cost_usd >= cfg.llm.daily_budget_usd) {
      throw new BudgetExceededError('일일 예산 초과로 재작성을 중단했다');
    }

    const prompt = rewritePagePrompt({
      name: page.name,
      slug: page.slug,
      narrative: page.narrative,
      timelineMarkdown: timelineMarkdown(page, cfg.compose.timeline_limit),
      seeds: cfg.categories.seeds,
    });

    const resp = await runClaude(prompt, {
      bin: cfg.llm.claude_bin,
      model: cfg.llm.rewrite_model,
      timeoutMs: cfg.llm.call_timeout_ms,
      signal: ctx.signal,
      spawnImpl: ctx.spawnImpl,
    });

    addUsage(
      db,
      {
        tokensIn: resp.usage.input_tokens,
        tokensOut: resp.usage.output_tokens,
        costUsd: resp.usage.cost_usd,
      },
      ctxNow(ctx),
    );

    // 파싱에 실패하면 throw 한다. compose 가 직전 버전 파일을 그대로 둔다 (PRD 6.3).
    return validateRewriteResult(extractJsonBlock(resp.text));
  };
}
