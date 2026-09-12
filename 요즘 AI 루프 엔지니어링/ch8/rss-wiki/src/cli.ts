#!/usr/bin/env -S node --experimental-strip-types

/** rss-wiki CLI. 서브커맨드별로 필요한 모듈을 동적 import 한다. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadConfig, loadFeeds } from './config.ts';
import { openDb } from './db/index.ts';
import { doctor, formatReport } from './doctor.ts';
import type { AppConfig } from './types.ts';
import { createLogger } from './util/log.ts';
import type { StageCtx } from './stage.ts';

const HELP = `rss-wiki - RSS 요약 위키 CLI

사용법: rss-wiki <명령> [옵션]

명령:
  collect                  피드 수집
  extract                  본문 확보
  dedupe                   중복 제거
  enrich [--concurrency N] LLM 요약/분류
  compose [--rewrite-all]  위키 페이지 갱신
  build [--mode static|local]  정적 사이트 빌드
  run [--trigger cron|manual]  전체 파이프라인 실행
  serve [--port N]         로컬 서버 실행
  search <질의어>           검색
  feeds add <url> [--name] 피드 추가
  feeds list                피드 목록
  feeds disable <url>       피드 비활성화
  doctor                    운영 상태 점검
  help                      도움말 출력

공통 옵션:
  --config <path>  파이프라인 설정 파일 경로 (기본: config/rss-wiki.yaml)
  --feeds <path>   피드 목록 파일 경로 (기본: config/feeds.yaml)
  --db <path>      DB 파일 경로 (기본: 설정 파일의 dbPath)
`;

interface ParsedFeedsYaml {
  feeds?: Array<{
    url: string;
    name?: string;
    seed_categories?: string[];
    enabled?: boolean;
  }>;
}

function buildCtx(
  cfg: AppConfig,
  db: ReturnType<typeof openDb>,
  scope: string,
  feedsPath?: string,
): StageCtx {
  return { db, cfg, runId: null, log: createLogger(scope), feedsPath };
}

function openDbFor(cfg: AppConfig, dbOverride?: string): ReturnType<typeof openDb> {
  return openDb(dbOverride ?? cfg.dbPath);
}

function readFeedsYaml(path: string): ParsedFeedsYaml {
  if (!existsSync(path)) return { feeds: [] };
  return (parseYaml(readFileSync(path, 'utf8')) ?? { feeds: [] }) as ParsedFeedsYaml;
}

function writeFeedsYaml(path: string, data: ParsedFeedsYaml): void {
  writeFileSync(path, stringifyYaml(data), 'utf8');
}

async function cmdFeeds(positionals: string[], values: Record<string, unknown>): Promise<number> {
  const [sub, ...rest] = positionals;
  const feedsPath = (values.feeds as string) || 'config/feeds.yaml';

  if (sub === 'list') {
    const feeds = loadFeeds(feedsPath);
    console.log(`등록된 피드: ${feeds.length}개`);
    for (const f of feeds) {
      console.log(`  - ${f.enabled ? '[활성]' : '[비활성]'} ${f.name} (${f.url})`);
    }
    return 0;
  }

  if (sub === 'add') {
    const url = rest[0];
    if (!url) {
      console.error('feeds add 는 url 인자가 필요하다.');
      return 1;
    }
    const data = readFeedsYaml(feedsPath);
    data.feeds = data.feeds ?? [];
    if (data.feeds.some((f) => f.url === url)) {
      console.error(`이미 등록된 피드다: ${url}`);
      return 1;
    }
    const name = (values.name as string) || new URL(url).hostname;
    data.feeds.push({ url, name, seed_categories: [], enabled: true });
    writeFeedsYaml(feedsPath, data);
    console.log(`피드를 추가했다: ${name} (${url})`);
    return 0;
  }

  if (sub === 'disable') {
    const url = rest[0];
    if (!url) {
      console.error('feeds disable 은 url 인자가 필요하다.');
      return 1;
    }
    const data = readFeedsYaml(feedsPath);
    const feed = (data.feeds ?? []).find((f) => f.url === url);
    if (!feed) {
      console.error(`등록되지 않은 피드다: ${url}`);
      return 1;
    }
    feed.enabled = false;
    writeFeedsYaml(feedsPath, data);
    console.log(`피드를 비활성화했다: ${url}`);
    return 0;
  }

  console.error(`알 수 없는 feeds 서브커맨드: ${sub ?? ''}`);
  console.error(HELP);
  return 1;
}

export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      feeds: { type: 'string' },
      db: { type: 'string' },
      concurrency: { type: 'string' },
      'rewrite-all': { type: 'boolean' },
      mode: { type: 'string' },
      trigger: { type: 'string' },
      port: { type: 'string' },
      name: { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  });

  const [command, ...rest] = positionals;

  if (!command || command === 'help') {
    console.log(HELP);
    return 0;
  }

  if (command === 'feeds') {
    return cmdFeeds(rest, values as Record<string, unknown>);
  }

  const configPath = (values.config as string) || 'config/rss-wiki.yaml';
  const cfg = loadConfig(configPath);
  const dbOverride = values.db as string | undefined;
  const feedsPath = values.feeds as string | undefined;

  if (command === 'doctor') {
    const db = openDbFor(cfg, dbOverride);
    const report = await doctor(db, cfg);
    console.log(formatReport(report));
    return report.problems > 0 ? 1 : 0;
  }

  if (command === 'collect') {
    const db = openDbFor(cfg, dbOverride);
    const ctx = buildCtx(cfg, db, 'cli:collect', feedsPath);
    const { collect } = await import('./collect/index.ts');
    const result = await collect(ctx);
    console.log(
      `수집 완료: 피드 성공 ${result.feedsOk}개, 실패 ${result.feedsFailed}개, 신규 글 ${result.articlesNew}개`,
    );
    return result.feedsFailed > 0 ? 1 : 0;
  }

  if (command === 'extract') {
    const db = openDbFor(cfg, dbOverride);
    const ctx = buildCtx(cfg, db, 'cli:extract');
    const { extract } = await import('./extract/index.ts');
    const result = await extract(ctx);
    console.log(
      `본문 추출 완료: 성공 ${result.ok}개, 실패 ${result.failed}개, rss_fallback ${result.fallback}개`,
    );
    return result.failed > 0 ? 1 : 0;
  }

  if (command === 'dedupe') {
    const db = openDbFor(cfg, dbOverride);
    const ctx = buildCtx(cfg, db, 'cli:dedupe');
    const { dedupe } = await import('./dedupe/index.ts');
    const result = await dedupe(ctx);
    console.log(`중복 제거 완료: 클러스터 ${result.clusters}개, 중복 ${result.duplicates}건`);
    return 0;
  }

  if (command === 'enrich') {
    const db = openDbFor(cfg, dbOverride);
    if (values.concurrency) {
      const n = Math.max(1, Math.min(8, Number.parseInt(values.concurrency as string, 10) || 1));
      cfg.llm.concurrency = n;
    }
    const ctx = buildCtx(cfg, db, 'cli:enrich');
    const { enrich } = await import('./enrich/index.ts');
    const result = await enrich(ctx);
    const interruptedNote =
      result.interrupted > 0 ? `, 예산/취소로 중단 ${result.interrupted}개` : '';
    const partialNote = result.partial ? ' (부분 완료)' : '';
    console.log(
      `요약 완료${partialNote}: 성공 ${result.ok}개, 실패 ${result.failed}개${interruptedNote}, ` +
        `토큰 in/out ${result.tokensIn}/${result.tokensOut}, 비용 $${result.costUsd.toFixed(4)}`,
    );
    return result.failed > 0 ? 1 : 0;
  }

  if (command === 'compose') {
    const db = openDbFor(cfg, dbOverride);
    const ctx = buildCtx(cfg, db, 'cli:compose');
    const { compose } = await import('./compose/index.ts');
    const { createRewriteFn } = await import('./llm/rewriteRunner.ts');
    const result = await compose(ctx, {
      rewriteAll: Boolean(values['rewrite-all']),
      rewriteFn: createRewriteFn(ctx) ?? undefined,
    });
    console.log(
      `위키 갱신 완료: 페이지 ${result.pagesUpdated}개 갱신, 재작성 ${result.rewritten}개, 아카이브 ${result.archived}건`,
    );
    return 0;
  }

  if (command === 'build') {
    const db = openDbFor(cfg, dbOverride);
    const ctx = buildCtx(cfg, db, 'cli:build');
    const { build } = await import('./build/index.ts');
    const modeArg = values.mode as string | undefined;
    const mode: 'static' | 'local' | undefined =
      modeArg === 'static' || modeArg === 'local' ? modeArg : undefined;
    const opts = mode ? { mode } : undefined;
    const result = await build(ctx, opts);
    console.log(
      `빌드 완료: 페이지 ${result.pages}개, 검색 인덱스 ${result.indexBytes}바이트${
        result.reduced ? ' (축소됨)' : ''
      }`,
    );
    return 0;
  }

  if (command === 'run') {
    const db = openDbFor(cfg, dbOverride);
    const trigger = (values.trigger as string) === 'cron' ? 'cron' : 'manual';
    const log = createLogger('cli:run');
    const { createRun } = await import('./jobs/runs.ts');
    const { runPipeline } = await import('./jobs/pipeline.ts');
    const runId = createRun(db, trigger);
    const result = await runPipeline({
      db,
      cfg,
      runId,
      log,
      ctxExtra: feedsPath ? { feedsPath } : undefined,
    });
    console.log(`파이프라인 실행 완료: runId=${runId}`);
    console.log(JSON.stringify(result));
    return 0;
  }

  if (command === 'serve') {
    const db = openDbFor(cfg, dbOverride);
    if (values.port) cfg.server.port = Number.parseInt(values.port as string, 10);
    const { serve } = await import('./server/index.ts');
    const { url } = await serve({ db, cfg, feedsPath });
    console.log(`서버 시작: ${url}`);
    return 0;
  }

  if (command === 'search') {
    const q = rest.join(' ').trim();
    if (!q) {
      console.error('search 는 질의어가 필요하다.');
      return 1;
    }
    const db = openDbFor(cfg, dbOverride);
    const { search } = await import('./search/index.ts');
    const results = await search(db, q);
    console.log(`검색 결과 ${Array.isArray(results) ? results.length : 0}건`);
    console.log(JSON.stringify(results));
    return 0;
  }

  console.error(`알 수 없는 명령이다: ${command}`);
  console.error(HELP);
  return 1;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
