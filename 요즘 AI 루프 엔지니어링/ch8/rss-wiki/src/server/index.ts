/** T6.5 + T6.6 HTTP 서버: 수집 트리거 API + 정적 파일 서빙. */
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { URL } from 'node:url';
import type { Db } from '../db/index.ts';
import type { StageFns } from '../jobs/pipeline.ts';
import { ActiveRunError, createRun, getProgress, listRuns, requestCancel } from '../jobs/runs.ts';
import { JobWorker } from '../jobs/worker.ts';
import type { AppConfig, RunProgress, RunStatus } from '../types.ts';
import { tailLog } from '../util/log.ts';

export interface ServeOptions {
  db: Db;
  cfg: AppConfig;
  worker?: JobWorker;
  distDir?: string;
  stages?: StageFns;
  /** feeds.yaml 경로. 미지정이면 config/feeds.yaml */
  feedsPath?: string;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  'done',
  'partial',
  'failed',
  'cancelled',
  'stale',
]);

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(data);
}

export function createServer(opts: ServeOptions): http.Server {
  const { db, cfg } = opts;
  const distDir = resolve(opts.distDir ?? cfg.build.out_dir);
  const worker =
    opts.worker ?? new JobWorker({ db, cfg, stages: opts.stages, feedsPath: opts.feedsPath });

  function handleCreateRun(res: http.ServerResponse): void {
    if (!cfg.server.enable_manual_run) {
      sendJson(res, 403, { message: '수동 실행이 비활성화되어 있다' });
      return;
    }
    try {
      const runId = createRun(db, 'manual', cfg.server.stale_job_timeout_ms);
      worker.start(runId);
      sendJson(res, 202, { runId, status: 'queued' });
    } catch (e) {
      if (e instanceof ActiveRunError) {
        const progress = getProgress(db, e.runId);
        sendJson(res, 409, {
          runId: e.runId,
          status: progress?.status ?? 'running',
          message: '이미 실행 중인 잡이 있다',
        });
        return;
      }
      throw e;
    }
  }

  function handleGetRun(res: http.ServerResponse, runId: string): void {
    const progress = getProgress(db, runId);
    if (!progress) {
      sendJson(res, 404, { message: 'run을 찾을 수 없다' });
      return;
    }
    sendJson(res, 200, progress);
  }

  function handleListRuns(res: http.ServerResponse, url: URL): void {
    const raw = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10;
    sendJson(res, 200, listRuns(db, limit));
  }

  function handleCancel(res: http.ServerResponse, runId: string): void {
    requestCancel(db, runId);
    sendJson(res, 202, { runId, cancelRequested: true });
  }

  function handleLogs(res: http.ServerResponse, runId: string, url: URL): void {
    const raw = Number(url.searchParams.get('lines'));
    const lines = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 50;
    sendJson(res, 200, { runId, lines: tailLog(runId, lines) });
  }

  function handleStream(req: http.IncomingMessage, res: http.ServerResponse, runId: string): void {
    const progress = getProgress(db, runId);
    if (!progress) {
      sendJson(res, 404, { message: 'run을 찾을 수 없다' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    let finished = false;

    function finish(): void {
      if (finished) return;
      finished = true;
      res.write('event: done\ndata: {}\n\n');
      worker.off(runId, listener);
      res.end();
    }

    function send(p: RunProgress): void {
      if (finished) return;
      res.write(`data: ${JSON.stringify(p)}\n\n`);
      if (TERMINAL_STATUSES.has(p.status)) finish();
    }

    const listener = (p: RunProgress) => send(p);
    worker.on(runId, listener);

    send(progress);

    req.on('close', () => {
      finished = true;
      worker.off(runId, listener);
    });
  }

  function serveStatic(res: http.ServerResponse, pathname: string): void {
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const target = resolve(distDir, normalize(rel));

    // 경로 탈출 방어: distDir 바깥으로 나가면 거부한다.
    if (target !== distDir && !target.startsWith(distDir + sep)) {
      sendJson(res, 403, { message: '허용되지 않은 경로다' });
      return;
    }

    let filePath = target;
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      sendJson(res, 404, { message: '파일을 찾을 수 없다' });
      return;
    }

    const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    createReadStream(filePath).pipe(res);
  }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://internal');
    const pathname = decodeURIComponent(url.pathname);

    try {
      if (method === 'POST' && pathname === '/api/runs') {
        handleCreateRun(res);
        return;
      }

      const streamMatch = pathname.match(/^\/api\/runs\/([^/]+)\/stream$/);
      if (method === 'GET' && streamMatch) {
        handleStream(req, res, streamMatch[1]);
        return;
      }

      const cancelMatch = pathname.match(/^\/api\/runs\/([^/]+)\/cancel$/);
      if (method === 'POST' && cancelMatch) {
        handleCancel(res, cancelMatch[1]);
        return;
      }

      if (method === 'GET' && pathname === '/api/runs') {
        handleListRuns(res, url);
        return;
      }

      const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
      if (method === 'GET' && runMatch) {
        handleGetRun(res, runMatch[1]);
        return;
      }

      const logMatch = pathname.match(/^\/api\/logs\/([^/]+)$/);
      if (method === 'GET' && logMatch) {
        handleLogs(res, logMatch[1], url);
        return;
      }

      if (method === 'GET') {
        serveStatic(res, pathname);
        return;
      }

      sendJson(res, 404, { message: 'not found' });
    } catch (e) {
      sendJson(res, 500, { message: e instanceof Error ? e.message : String(e) });
    }
  }

  return http.createServer((req, res) => {
    void handle(req, res);
  });
}

export async function serve(
  opts: ServeOptions,
): Promise<{ server: http.Server; url: string; close: () => Promise<void> }> {
  const server = createServer(opts);
  const host = opts.cfg.server.host;
  const port = opts.cfg.server.port;

  await new Promise<void>((res, rej) => {
    server.once('error', rej);
    server.listen(port, host, () => res());
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const url = `http://${host}:${actualPort}`;

  return {
    server,
    url,
    close: () =>
      new Promise<void>((res, rej) => {
        server.close((err) => (err ? rej(err) : res()));
      }),
  };
}
