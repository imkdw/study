import type { Db } from './db/index.ts';
import type { AppConfig, Stage } from './types.ts';
import type { Logger } from './util/log.ts';

/** 모든 파이프라인 스테이지가 공유하는 실행 컨텍스트. */
export interface StageCtx {
  db: Db;
  cfg: AppConfig;
  /** 잡 없이 CLI 단독 실행이면 null */
  runId: string | null;
  log: Logger;
  /** 협조적 취소 신호 */
  signal?: AbortSignal;
  /** 진행률 보고. 워커가 하나 끝낼 때마다 호출한다. */
  onProgress?: (stage: Stage, done: number, total: number) => void;
  /** 네트워크 주입점. 테스트에서 교체한다. */
  fetchImpl?: typeof fetch;
  /** 현재 시각 주입점. 테스트에서 교체한다. */
  now?: () => Date;
  /** feeds.yaml 경로 주입점. 미지정이면 config/feeds.yaml */
  feedsPath?: string;
  /** true 면 feeds.yaml 동기화를 건너뛰고 DB 의 피드만 쓴다 */
  skipFeedSync?: boolean;
}

export function isCancelled(ctx: StageCtx): boolean {
  return Boolean(ctx.signal?.aborted);
}

export class CancelledError extends Error {
  readonly kind = 'cancelled';
  constructor() {
    super('cancelled');
  }
}

export function throwIfCancelled(ctx: StageCtx): void {
  if (isCancelled(ctx)) throw new CancelledError();
}

export function ctxNow(ctx: StageCtx): Date {
  return ctx.now ? ctx.now() : new Date();
}

export function ctxFetch(ctx: StageCtx): typeof fetch {
  return ctx.fetchImpl ?? fetch;
}
