/** 잡 파이프라인 러너: collect -> extract -> dedupe -> enrich -> compose -> build. */
import { nowIso } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import { CancelledError } from '../stage.ts';
import type { StageCtx } from '../stage.ts';
import { STAGES } from '../types.ts';
import type { AppConfig, RunProgress, RunStatus, Stage } from '../types.ts';
import type { Logger } from '../util/log.ts';
import { getProgress, heartbeat, isCancelRequested, setRunStatus, setStage } from './runs.ts';

// ---------- 스테이지 함수 계약 ----------

export interface StageFns {
  collect: (ctx: StageCtx) => Promise<{ feedsOk: number; feedsFailed: number; articlesNew: number }>;
  extract: (ctx: StageCtx) => Promise<{ ok: number; failed: number; fallback: number }>;
  dedupe: (ctx: StageCtx) => Promise<{ clusters: number; duplicates: number }>;
  enrich: (ctx: StageCtx) => Promise<{
    ok: number;
    failed: number;
    interrupted?: number;
    partial: boolean;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  }>;
  compose: (ctx: StageCtx) => Promise<{ pagesUpdated: number; rewritten: number; archived: number }>;
  build: (ctx: StageCtx) => Promise<{ pages: number; indexBytes: number; reduced: boolean }>;
}

/** 다른 스테이지 모듈은 아직 동시에 만들어지는 중이라 정적 import 하지 않는다. */
export async function loadStageFns(): Promise<StageFns> {
  const [collectMod, extractMod, dedupeMod, enrichMod, composeMod, buildMod, rewriteMod] =
    await Promise.all([
      import('../collect/index.ts'),
      import('../extract/index.ts'),
      import('../dedupe/index.ts'),
      import('../enrich/index.ts'),
      import('../compose/index.ts'),
      import('../build/index.ts'),
      import('../llm/rewriteRunner.ts'),
    ]);
  return {
    collect: collectMod.collect,
    extract: extractMod.extract,
    dedupe: dedupeMod.dedupe,
    enrich: enrichMod.enrich,
    // 전체 재작성은 LLM 호출이므로 여기서 러너를 주입한다.
    // 예산이 소진됐으면 createRewriteFn 이 null 을 주고, compose 는 증분 갱신만 한다.
    compose: (ctx: StageCtx) =>
      composeMod.compose(ctx, { rewriteFn: rewriteMod.createRewriteFn(ctx) ?? undefined }),
    build: buildMod.build,
  } as StageFns;
}

// ---------- 실행 옵션 ----------

export interface RunPipelineOptions {
  db: Db;
  cfg: AppConfig;
  runId: string;
  log: Logger;
  stages?: StageFns;
  signal?: AbortSignal;
  heartbeatMs?: number;
  /** 취소 플래그 폴링 주기. 기본 1초. */
  cancelPollMs?: number;
  onProgress?: (p: RunProgress) => void;
  buildMode?: 'static' | 'local';
  /** 스테이지 컨텍스트에 덧붙일 주입점 (fetchImpl / feedsPath / skipFeedSync 등). 테스트에서 쓴다. */
  ctxExtra?: Partial<StageCtx>;
}

/** 실패해도 다음 단계로 넘어가는 스테이지: 로그만 남기고 계속한다. */
const CONTINUE_ON_FAILURE = new Set<Stage>(['collect', 'extract', 'dedupe']);

export async function runPipeline(opts: RunPipelineOptions): Promise<RunProgress> {
  const { db, cfg, runId, log } = opts;
  const stages = opts.stages ?? (await loadStageFns());
  const heartbeatMs = opts.heartbeatMs ?? 15000;

  const hbTimer = setInterval(() => heartbeat(db, runId), heartbeatMs);
  if (typeof hbTimer.unref === 'function') hbTimer.unref();

  const controller = new AbortController();

  // 취소는 DB 플래그로 들어온다. 단계 경계에서만 확인하면 긴 스테이지(대량 extract 등)에서
  // 수십 초씩 반응이 없으므로, 짧은 주기로 폴링해 진행 중인 스테이지의 루프까지 즉시 끊는다.
  const cancelPollMs = opts.cancelPollMs ?? 1000;
  const cancelTimer = setInterval(() => {
    if (controller.signal.aborted) return;
    if (isCancelRequested(db, runId)) controller.abort();
  }, cancelPollMs);
  if (typeof cancelTimer.unref === 'function') cancelTimer.unref();
  const onExternalAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onExternalAbort);
  if (opts.signal?.aborted) controller.abort();

  setRunStatus(db, runId, 'running', { started_at: nowIso() });

  const emit = () => {
    const p = getProgress(db, runId);
    if (p) opts.onProgress?.(p);
  };
  emit();

  let hardFailed = false;
  let cancelled = false;
  let partial = false;
  let errorCount = 0;

  const totals = {
    feedsOk: 0,
    feedsFailed: 0,
    articlesNew: 0,
    articlesFailed: 0,
    pagesUpdated: 0,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
  };

  try {
    for (const stage of STAGES) {
      if (controller.signal.aborted || isCancelRequested(db, runId)) {
        controller.abort();
        cancelled = true;
        break;
      }

      setStage(db, runId, stage, { status: 'running', started_at: nowIso() });
      setRunStatus(db, runId, 'running', { stage });
      emit();

      const ctx: StageCtx & { buildMode?: 'static' | 'local' } = {
        db,
        cfg,
        runId,
        log,
        ...opts.ctxExtra,
        signal: controller.signal,
        buildMode: opts.buildMode,
        onProgress: (s, done, total) => {
          setStage(db, runId, s, { done, total });
          emit();
        },
      };

      try {
        const result = await stages[stage](ctx);
        setStage(db, runId, stage, { status: 'done', finished_at: nowIso() });
        applyResult(totals, stage, result);
        if (stage === 'enrich' && (result as { partial: boolean }).partial) partial = true;
      } catch (e) {
        if (e instanceof CancelledError || controller.signal.aborted) {
          setStage(db, runId, stage, { status: 'failed', error: 'cancelled', finished_at: nowIso() });
          cancelled = true;
          emit();
          break;
        }

        const message = e instanceof Error ? e.message : String(e);
        setStage(db, runId, stage, { status: 'failed', error: message, finished_at: nowIso() });
        errorCount += 1;
        log.error(`스테이지 ${stage} 실패`, { error: message });
        emit();

        if (!CONTINUE_ON_FAILURE.has(stage)) {
          hardFailed = true;
          break;
        }
        continue;
      }

      emit();
    }
  } finally {
    clearInterval(hbTimer);
    clearInterval(cancelTimer);
    opts.signal?.removeEventListener('abort', onExternalAbort);
  }

  let finalStatus: RunStatus;
  if (cancelled) finalStatus = 'cancelled';
  else if (hardFailed) finalStatus = 'failed';
  else finalStatus = partial ? 'partial' : 'done';

  setRunStatus(db, runId, finalStatus, {
    finished_at: nowIso(),
    feeds_ok: totals.feedsOk,
    feeds_failed: totals.feedsFailed,
    articles_new: totals.articlesNew,
    articles_failed: totals.articlesFailed,
    pages_updated: totals.pagesUpdated,
    tokens_in: totals.tokensIn,
    tokens_out: totals.tokensOut,
    cost_usd: totals.costUsd,
  });

  emit();

  log.info(
    `run ${runId} 종료: status=${finalStatus} feedsOk=${totals.feedsOk} articlesNew=${totals.articlesNew} ` +
      `pagesUpdated=${totals.pagesUpdated} tokensIn=${totals.tokensIn} tokensOut=${totals.tokensOut} ` +
      `costUsd=${totals.costUsd} errors=${errorCount}`,
  );

  const finalProgress = getProgress(db, runId);
  if (!finalProgress) throw new Error(`run ${runId} 을 찾을 수 없다`);
  return finalProgress;
}

type Totals = {
  feedsOk: number;
  feedsFailed: number;
  articlesNew: number;
  articlesFailed: number;
  pagesUpdated: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

function applyResult(totals: Totals, stage: Stage, result: unknown): void {
  const r = result as Record<string, number | boolean>;
  switch (stage) {
    case 'collect':
      totals.feedsOk = Number(r.feedsOk ?? 0);
      totals.feedsFailed = Number(r.feedsFailed ?? 0);
      totals.articlesNew = Number(r.articlesNew ?? 0);
      break;
    case 'extract':
      totals.articlesFailed += Number(r.failed ?? 0);
      break;
    case 'enrich':
      totals.articlesFailed += Number(r.failed ?? 0);
      totals.tokensIn += Number(r.tokensIn ?? 0);
      totals.tokensOut += Number(r.tokensOut ?? 0);
      totals.costUsd += Number(r.costUsd ?? 0);
      break;
    case 'compose':
      totals.pagesUpdated = Number(r.pagesUpdated ?? 0);
      break;
    default:
      break;
  }
}
