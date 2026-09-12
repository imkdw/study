/** 일일 LLM 사용량 예산 가드. budget_usage 테이블을 날짜 키로 누적한다. */

import type { Db } from '../db/index.ts';
import type { AppConfig } from '../types.ts';

/** Asia/Seoul 등 지정 타임존 기준 YYYY-MM-DD 키. */
export function todayKey(now: Date = new Date(), tz = 'Asia/Seoul'): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now);
}

export interface UsageDelta {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

/** 오늘 사용량에 누적한다 (upsert). */
export function addUsage(db: Db, usage: UsageDelta, now: Date = new Date()): void {
  const day = todayKey(now);
  db.prepare(
    `INSERT INTO budget_usage (day, cost_usd, tokens_in, tokens_out)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       cost_usd = cost_usd + excluded.cost_usd,
       tokens_in = tokens_in + excluded.tokens_in,
       tokens_out = tokens_out + excluded.tokens_out`,
  ).run(day, usage.costUsd, usage.tokensIn, usage.tokensOut);
}

export interface UsageRow {
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
}

/** 오늘 누적 사용량. 기록이 없으면 0. */
export function getUsage(db: Db, now: Date = new Date()): UsageRow {
  const row = db
    .prepare('SELECT cost_usd, tokens_in, tokens_out FROM budget_usage WHERE day = ?')
    .get(todayKey(now)) as UsageRow | undefined;
  return row ?? { cost_usd: 0, tokens_in: 0, tokens_out: 0 };
}

/** 오늘 지출이 일일 예산을 넘었는지. */
export function isBudgetExceeded(db: Db, cfg: AppConfig, now: Date = new Date()): boolean {
  return getUsage(db, now).cost_usd >= cfg.llm.daily_budget_usd;
}

/** 오늘 남은 예산 (0 미만으로 내려가지 않는다). */
export function remainingBudget(db: Db, cfg: AppConfig, now: Date = new Date()): number {
  const remaining = cfg.llm.daily_budget_usd - getUsage(db, now).cost_usd;
  return Math.max(0, remaining);
}
