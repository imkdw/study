/** 잡 큐: runs / run_stages 테이블을 다루는 저수준 API. PRD 5.8 절 계약을 따른다. */
import { randomInt } from 'node:crypto';
import { nowIso } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import { STAGES } from '../types.ts';
import type { RunProgress, RunStatus, RunTrigger, Stage, StageProgress } from '../types.ts';

// ---------- run id (ULID 계열) ----------

/** Crockford base32: 사람이 읽기 헷갈리는 I, L, O, U 를 제외한다. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(time: number, len: number): string {
  let t = time;
  let out = '';
  for (let i = len - 1; i >= 0; i--) {
    out = CROCKFORD[t % 32] + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function encodeRandom(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += CROCKFORD[randomInt(32)];
  return out;
}

/**
 * `run_` + 26자 Crockford base32 ULID 계열 id.
 * 앞 10자는 밀리초 타임스탬프(시간순 정렬 가능), 뒤 16자는 무작위(충돌 방지)다.
 * 외부 라이브러리 없이 직접 구현한다.
 */
export function newRunId(): string {
  return `run_${encodeTime(Date.now(), 10)}${encodeRandom(16)}`;
}

// ---------- 에러 ----------

/** 이미 활성(queued/running) run 이 있어 새 run 을 만들지 못했을 때 던진다. */
export class ActiveRunError extends Error {
  runId: string;
  constructor(runId: string) {
    super(`active run already exists: ${runId}`);
    this.name = 'ActiveRunError';
    this.runId = runId;
  }
}

// ---------- 조회 ----------

interface RunRow {
  id: string;
  trigger: RunTrigger;
  status: RunStatus;
  stage: Stage | null;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  cancel_requested: number;
  feeds_ok: number;
  feeds_failed: number;
  articles_new: number;
  articles_failed: number;
  pages_updated: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: string;
}

interface StageRow {
  stage: Stage;
  status: StageProgress['status'];
  done: number;
  total: number;
  error: string | null;
}

/** 현재 활성(queued/running) run 하나. 동시 실행은 1개로 제한된다. */
export function activeRun(db: Db): { id: string; status: RunStatus } | null {
  const row = db
    .prepare(`SELECT id, status FROM runs WHERE status IN ('queued', 'running') LIMIT 1`)
    .get() as { id: string; status: RunStatus } | undefined;
  return row ?? null;
}

function buildStages(db: Db, runId: string): Record<Stage, StageProgress> {
  const rows = db
    .prepare(`SELECT stage, status, done, total, error FROM run_stages WHERE run_id = ?`)
    .all(runId) as unknown as StageRow[];
  const byStage = new Map(rows.map((r) => [r.stage, r]));
  const out = {} as Record<Stage, StageProgress>;
  for (const stage of STAGES) {
    const r = byStage.get(stage);
    out[stage] = r
      ? { status: r.status, done: r.done, total: r.total, error: r.error }
      : { status: 'pending' };
  }
  return out;
}

/** PRD 5.8 의 진행 페이로드 JSON 구조를 만든다. run 이 없으면 null. */
export function getProgress(db: Db, runId: string, now: () => Date = () => new Date()): RunProgress | null {
  const row = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) as RunRow | undefined;
  if (!row) return null;

  const stages = buildStages(db, runId);
  // 실패는 세 군데에서 난다: 스테이지 자체 / 피드 수집 / 글 처리.
  // 셋을 합쳐야 UI 가 "오류 0건" 이라고 잘못 말하지 않는다.
  const stageErrors = Object.values(stages).filter((s) => s.error != null).length;
  const feedErrors = row.feeds_failed ?? 0;
  const articleErrors = row.articles_failed ?? 0;
  const errors = stageErrors + feedErrors + articleErrors;

  const startRef = row.started_at ?? row.created_at;
  const startMs = new Date(startRef).getTime();
  const endMs = row.finished_at ? new Date(row.finished_at).getTime() : now().getTime();

  return {
    runId: row.id,
    status: row.status,
    stage: row.stage,
    stages,
    startedAt: row.started_at,
    elapsedMs: Math.max(0, endMs - startMs),
    errors,
    errorBreakdown: { stages: stageErrors, feeds: feedErrors, articles: articleErrors },
    articlesNew: row.articles_new,
    pagesUpdated: row.pages_updated,
  };
}

/** 최근 실행 이력. 생성 시각 역순. */
export function listRuns(db: Db, limit = 10): RunProgress[] {
  const rows = db
    .prepare(`SELECT id FROM runs ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as unknown as { id: string }[];
  const out: RunProgress[] = [];
  for (const r of rows) {
    const p = getProgress(db, r.id);
    if (p) out.push(p);
  }
  return out;
}

// ---------- stale 회수 ----------

/**
 * queued/running 이면서 heartbeat(없으면 생성 시각)가 staleTimeoutMs 이상 지난 잡을
 * status='stale' 로 회수한다. 회수한 개수를 반환한다.
 */
export function reclaimStale(db: Db, staleTimeoutMs: number, now: () => Date = () => new Date()): number {
  const cutoff = new Date(now().getTime() - staleTimeoutMs).toISOString();
  const finishedAt = now().toISOString();
  const result = db
    .prepare(
      `UPDATE runs SET status = 'stale', finished_at = ?
       WHERE status IN ('queued', 'running')
         AND COALESCE(heartbeat_at, created_at) < ?`,
    )
    .run(finishedAt, cutoff);
  return Number(result.changes);
}

// ---------- 생성 / 갱신 ----------

/**
 * 새 run 을 큐에 넣는다. 삽입 전에 죽은 잡을 먼저 회수한다.
 * 부분 유니크 인덱스(one_active_run) 위반이면 현재 활성 run 을 조회해 ActiveRunError 를 던진다.
 */
export function createRun(db: Db, trigger: RunTrigger, staleTimeoutMs = 60000): string {
  reclaimStale(db, staleTimeoutMs);

  const id = newRunId();
  const now = nowIso();
  try {
    db.prepare(
      `INSERT INTO runs (id, trigger, status, stage, heartbeat_at, cancel_requested, created_at)
       VALUES (?, ?, 'queued', NULL, ?, 0, ?)`,
    ).run(id, trigger, now, now);
  } catch (e) {
    const active = activeRun(db);
    if (active) throw new ActiveRunError(active.id);
    throw e;
  }

  const insertStage = db.prepare(`INSERT INTO run_stages (run_id, stage, status) VALUES (?, ?, 'pending')`);
  for (const stage of STAGES) insertStage.run(id, stage);

  return id;
}

export function heartbeat(db: Db, runId: string): void {
  db.prepare(`UPDATE runs SET heartbeat_at = ? WHERE id = ?`).run(nowIso(), runId);
}

/** runs 테이블 갱신용 부분 패치. 타입 스트리핑 제약상 파라미터 프로퍼티 없이 인터페이스로 선언한다. */
export interface RunPatch {
  stage?: Stage | null;
  started_at?: string;
  finished_at?: string;
  feeds_ok?: number;
  feeds_failed?: number;
  articles_new?: number;
  articles_failed?: number;
  pages_updated?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
}

export function setRunStatus(db: Db, runId: string, status: RunStatus, patch: RunPatch = {}): void {
  const fields: string[] = ['status = ?'];
  const values: unknown[] = [status];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`);
    values.push(v);
  }
  values.push(runId);
  db.prepare(`UPDATE runs SET ${fields.join(', ')} WHERE id = ?`).run(...(values as never[]));
}

/** run_stages 갱신용 부분 패치. StageProgress 필드에 시작/종료 시각을 더한다. */
export interface StagePatch extends Partial<StageProgress> {
  started_at?: string;
  finished_at?: string;
}

export function setStage(db: Db, runId: string, stage: Stage, patch: StagePatch): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.status !== undefined) {
    fields.push('status = ?');
    values.push(patch.status);
  }
  if (patch.done !== undefined) {
    fields.push('done = ?');
    values.push(patch.done);
  }
  if (patch.total !== undefined) {
    fields.push('total = ?');
    values.push(patch.total);
  }
  if (patch.error !== undefined) {
    fields.push('error = ?');
    values.push(patch.error);
  }
  if (patch.started_at !== undefined) {
    fields.push('started_at = ?');
    values.push(patch.started_at);
  }
  if (patch.finished_at !== undefined) {
    fields.push('finished_at = ?');
    values.push(patch.finished_at);
  }
  if (fields.length === 0) return;
  values.push(runId, stage);
  db.prepare(`UPDATE run_stages SET ${fields.join(', ')} WHERE run_id = ? AND stage = ?`).run(
    ...(values as never[]),
  );
}

// ---------- 취소 ----------

/** 취소 요청 플래그를 세운다. 활성 run 이 아니면 아무 일도 하지 않는다. */
export function requestCancel(db: Db, runId: string): boolean {
  const result = db
    .prepare(`UPDATE runs SET cancel_requested = 1 WHERE id = ? AND status IN ('queued', 'running')`)
    .run(runId);
  return Number(result.changes) > 0;
}

export function isCancelRequested(db: Db, runId: string): boolean {
  const row = db.prepare(`SELECT cancel_requested FROM runs WHERE id = ?`).get(runId) as
    | { cancel_requested: number }
    | undefined;
  return row?.cancel_requested === 1;
}
