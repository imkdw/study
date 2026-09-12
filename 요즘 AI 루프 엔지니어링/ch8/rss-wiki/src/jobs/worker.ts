/** 같은 프로세스 안에서 run 하나를 백그라운드로 돌리는 워커. HTTP 요청과 무관하게 계속 진행된다. */
import { EventEmitter } from 'node:events';
import type { Db } from '../db/index.ts';
import type { AppConfig, RunProgress } from '../types.ts';
import { createLogger } from '../util/log.ts';
import { runPipeline } from './pipeline.ts';
import type { StageFns } from './pipeline.ts';
import { requestCancel } from './runs.ts';

export interface JobWorkerOptions {
  db: Db;
  cfg: AppConfig;
  stages?: StageFns;
  heartbeatMs?: number;
  /** feeds.yaml 경로. 미지정이면 config/feeds.yaml */
  feedsPath?: string;
}

export class JobWorker extends EventEmitter {
  private readonly db: Db;
  private readonly cfg: AppConfig;
  private readonly stages?: StageFns;
  private readonly heartbeatMs?: number;
  private readonly feedsPath?: string;
  private currentRunId: string | null = null;

  constructor(opts: JobWorkerOptions) {
    super();
    // SSE 구독자가 여럿일 수 있어 리스너 상한 경고를 끈다.
    this.setMaxListeners(0);
    this.db = opts.db;
    this.cfg = opts.cfg;
    this.stages = opts.stages;
    this.heartbeatMs = opts.heartbeatMs;
    this.feedsPath = opts.feedsPath;
  }

  /** 파이프라인을 백그라운드로 시작한다. await 하지 않고 즉시 반환한다. */
  start(runId: string): void {
    this.currentRunId = runId;
    const log = createLogger('worker', runId);

    void runPipeline({
      db: this.db,
      cfg: this.cfg,
      runId,
      log,
      stages: this.stages,
      heartbeatMs: this.heartbeatMs,
      ctxExtra: this.feedsPath ? { feedsPath: this.feedsPath } : undefined,
      onProgress: (p: RunProgress) => {
        this.emit(runId, p);
      },
    })
      .then((p) => {
        this.emit(runId, p);
      })
      .catch((e: unknown) => {
        log.error('파이프라인 실행 중 처리되지 않은 오류', {
          error: e instanceof Error ? e.message : String(e),
        });
      })
      .finally(() => {
        if (this.currentRunId === runId) this.currentRunId = null;
      });
  }

  /** 현재 진행 중인 runId. 없으면 null. */
  current(): string | null {
    return this.currentRunId;
  }

  /** 협조적 취소 요청. 파이프라인이 취소 플래그를 1초 주기로 폴링해 진행 중인 스테이지까지 끊는다. */
  cancel(runId: string): boolean {
    return requestCancel(this.db, runId);
  }
}
