/** 운영 상태 점검: claude CLI / dead_letter / unhealthy feed / pending category / stale job / 예산. */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Db } from './db/index.ts';
import { getUsage } from './util/budget.ts';
import type { AppConfig } from './types.ts';

const execFileAsync = promisify(execFile);

export interface DoctorReport {
  claude: { ok: boolean; bin: string; version?: string; message?: string };
  deadLetter: Array<{ id: number; title: string; failed_reason: string | null }>;
  unhealthyFeeds: Array<{
    id: number;
    name: string;
    consecutive_failures: number;
    health: string;
  }>;
  pendingCategories: Array<{ slug: string; pending_count: number }>;
  staleJobs: Array<{ id: string; status: string; heartbeat_at: string | null }>;
  budget: {
    spent: number;
    limit: number;
    exceeded: boolean;
    /** 실측 호출당 평균 비용 (summaries 기준). 아직 호출이 없으면 null */
    avgCostPerArticle: number | null;
    /** 위 평균으로 하루 목표 처리량(articlesPerDay)을 돌렸을 때의 예상 비용 */
    projectedDailyCost: number | null;
    /** 예상 비용이 한도를 넘는가 */
    projectionOverBudget: boolean;
  };
  problems: number;
}

/** 비용 예측에 쓰는 하루 기준 글 수 (PRD 3절 성공 기준). */
const ARTICLES_PER_DAY = 30;

export type CheckClaude = (
  bin: string,
) => Promise<{ ok: boolean; version?: string; message?: string }>;

/**
 * 기본 claude CLI 확인. `claude --version` 을 실행해 본다.
 * RSS_WIKI_SKIP_CLAUDE_CHECK=1 이면 확인을 건너뛰고 ok:true 를 돌려준다 (테스트/CI 용).
 */
async function defaultCheckClaude(
  bin: string,
): Promise<{ ok: boolean; version?: string; message?: string }> {
  if (process.env.RSS_WIKI_SKIP_CLAUDE_CHECK === '1') {
    return { ok: true, message: '건너뜀 (RSS_WIKI_SKIP_CLAUDE_CHECK=1)' };
  }
  try {
    const { stdout } = await execFileAsync(bin, ['--version']);
    return { ok: true, version: stdout.trim() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

interface DeadLetterRow {
  id: number;
  title: string;
  failed_reason: string | null;
}

interface UnhealthyFeedRow {
  id: number;
  name: string;
  consecutive_failures: number;
  health: string;
}

interface PendingCategoryRow {
  slug: string;
  pending_count: number;
}

interface StaleJobRow {
  id: string;
  status: string;
  heartbeat_at: string | null;
  started_at: string | null;
}

export async function doctor(
  db: Db,
  cfg: AppConfig,
  opts: { checkClaude?: CheckClaude } = {},
): Promise<DoctorReport> {
  const checkClaude = opts.checkClaude ?? defaultCheckClaude;
  const claudeResult = await checkClaude(cfg.llm.claude_bin);
  const claude = { bin: cfg.llm.claude_bin, ...claudeResult };

  const deadLetter = db
    .prepare(`SELECT id, title, failed_reason FROM articles WHERE status = 'dead_letter'`)
    .all() as unknown as DeadLetterRow[];

  const unhealthyFeeds = db
    .prepare(
      `SELECT id, name, consecutive_failures, health FROM feeds WHERE health != 'healthy'`,
    )
    .all() as unknown as UnhealthyFeedRow[];

  const pendingCategories = db
    .prepare(`SELECT slug, pending_count FROM categories WHERE pending_count > 0`)
    .all() as unknown as PendingCategoryRow[];

  const now = Date.now();
  const cutoff = new Date(now - cfg.server.stale_job_timeout_ms).toISOString();
  const staleJobRows = db
    .prepare(
      `SELECT id, status, heartbeat_at, started_at FROM runs WHERE status IN ('queued', 'running')`,
    )
    .all() as unknown as StaleJobRow[];
  const staleJobs = staleJobRows
    .filter((r) => {
      const ref = r.heartbeat_at ?? r.started_at;
      return !ref || ref <= cutoff;
    })
    .map((r) => ({ id: r.id, status: r.status, heartbeat_at: r.heartbeat_at }));

  const usage = getUsage(db, new Date(now));
  const exceeded = usage.cost_usd >= cfg.llm.daily_budget_usd;

  // 실측 평균으로 하루치 비용을 예측한다. 호출당 고정 오버헤드가 커서
  // 예산 안에 들어가는지는 돌려 보기 전에는 알 수 없다.
  const costRow = db
    .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(cost_usd), 0) AS total FROM summaries')
    .get() as unknown as { n: number; total: number } | undefined;
  const sampleCount = costRow?.n ?? 0;
  const avgCostPerArticle = sampleCount > 0 ? (costRow?.total ?? 0) / sampleCount : null;
  const projectedDailyCost =
    avgCostPerArticle === null ? null : avgCostPerArticle * ARTICLES_PER_DAY;
  const projectionOverBudget =
    projectedDailyCost !== null && projectedDailyCost > cfg.llm.daily_budget_usd;

  const budget = {
    spent: usage.cost_usd,
    limit: cfg.llm.daily_budget_usd,
    exceeded,
    avgCostPerArticle,
    projectedDailyCost,
    projectionOverBudget,
  };

  const problems =
    deadLetter.length +
    unhealthyFeeds.length +
    pendingCategories.length +
    staleJobs.length +
    (claude.ok ? 0 : 1) +
    (exceeded ? 1 : 0) +
    (projectionOverBudget ? 1 : 0);

  return { claude, deadLetter, unhealthyFeeds, pendingCategories, staleJobs, budget, problems };
}

/** 콘솔용 한국어 리포트. */
export function formatReport(r: DoctorReport): string {
  const lines: string[] = [];
  lines.push('=== rss-wiki doctor 리포트 ===');

  lines.push(
    r.claude.ok
      ? `claude CLI: 정상 (${r.claude.bin}${r.claude.version ? `, ${r.claude.version}` : ''})`
      : `claude CLI: 실패 (${r.claude.bin}) - ${r.claude.message ?? '알 수 없는 오류'}`,
  );

  lines.push(`dead_letter 글: ${r.deadLetter.length}건`);
  for (const a of r.deadLetter) {
    lines.push(`  - #${a.id} ${a.title} (${a.failed_reason ?? '사유 없음'})`);
  }

  lines.push(`불건전 피드: ${r.unhealthyFeeds.length}건`);
  for (const f of r.unhealthyFeeds) {
    lines.push(`  - #${f.id} ${f.name} (health=${f.health}, 연속실패=${f.consecutive_failures})`);
  }

  lines.push(`승격 대기 카테고리: ${r.pendingCategories.length}건`);
  for (const c of r.pendingCategories) {
    lines.push(`  - ${c.slug} (대기=${c.pending_count})`);
  }

  lines.push(`정지된 잡: ${r.staleJobs.length}건`);
  for (const j of r.staleJobs) {
    lines.push(`  - ${j.id} (status=${j.status}, heartbeat=${j.heartbeat_at ?? '없음'})`);
  }

  lines.push(
    `예산: $${r.budget.spent.toFixed(4)} / $${r.budget.limit.toFixed(2)} ${r.budget.exceeded ? '(초과)' : ''}`,
  );
  if (r.budget.avgCostPerArticle !== null && r.budget.projectedDailyCost !== null) {
    lines.push(
      `비용 예측: 글당 $${r.budget.avgCostPerArticle.toFixed(4)} x ${ARTICLES_PER_DAY}글 = ` +
        `$${r.budget.projectedDailyCost.toFixed(2)}/일` +
        (r.budget.projectionOverBudget ? ' (한도 초과 예상)' : ''),
    );
  }

  lines.push(`문제 총합: ${r.problems}건`);
  return lines.join('\n');
}
