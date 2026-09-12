import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
let threshold: Level = (process.env.RSS_WIKI_LOG_LEVEL as Level) || 'info';

export function setLevel(l: Level): void {
  threshold = l;
}

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

function fmt(level: Level, scope: string, msg: string, meta?: unknown): string {
  const t = new Date().toISOString();
  const extra = meta === undefined ? '' : ` ${safeJson(meta)}`;
  return `[${t}] ${level.toUpperCase()} ${scope} ${msg}${extra}`;
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** 콘솔 로거. runId 를 주면 .rss-wiki/logs/{runId}.log 에도 남긴다. */
export function createLogger(scope: string, runId?: string, logDir = '.rss-wiki/logs'): Logger {
  const file = runId ? join(logDir, `${runId}.log`) : null;
  if (file) mkdirSync(dirname(file), { recursive: true });

  const emit = (level: Level) => (msg: string, meta?: unknown) => {
    if (ORDER[level] < ORDER[threshold]) return;
    const line = fmt(level, scope, msg, meta);
    if (level === 'error') console.error(line);
    else console.log(line);
    if (file) {
      try {
        appendFileSync(file, line + '\n');
      } catch {
        /* 로그 실패가 파이프라인을 막지 않는다 */
      }
    }
  };

  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
  };
}

/** 실패 시 UI 에 보여줄 마지막 N 줄 */
export function tailLog(runId: string, lines = 50, logDir = '.rss-wiki/logs'): string[] {
  try {
    const raw = readFileSync(join(logDir, `${runId}.log`), 'utf8');
    return raw.split('\n').filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}
