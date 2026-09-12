import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import type { AppConfig, FeedConfig } from './types.ts';

export const DEFAULT_CONFIG: AppConfig = {
  schedule: '0 7 * * *',
  timezone: 'Asia/Seoul',
  dbPath: '.rss-wiki/rss-wiki.db',
  collect: { backfill_limit: 20, max_articles_per_run: 200, fetch_timeout_ms: 10000 },
  extract: {
    rss_content_min_length: 1000,
    fetch_timeout_ms: 10000,
    rate_limit_per_domain_rps: 1,
    max_content_chars: 50000,
    user_agent: 'rss-wiki/1.0 (+https://github.com/rss-wiki; personal feed reader)',
  },
  dedupe: {
    title_similarity_threshold: 0.85,
    strip_query_params: [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'ref',
      'ref_src',
    ],
  },
  llm: {
    runner: 'claude-cli',
    claude_bin: 'claude',
    summarize_model: 'claude-haiku-4-5',
    rewrite_model: 'claude-sonnet-5',
    concurrency: 4,
    rewrite_concurrency: 2,
    call_timeout_ms: 120000,
    backoff_on_rate_limit_ms: [5000, 20000, 60000],
    daily_budget_usd: 0.5,
    language: 'ko',
  },
  server: {
    port: 4321,
    host: '127.0.0.1',
    enable_manual_run: true,
    stale_job_timeout_ms: 60000,
  },
  categories: {
    seeds: ['llm', 'infra', 'frontend', 'database', 'career', 'security'],
    promote_after: 3,
    low_confidence_threshold: 0.5,
  },
  compose: {
    timeline_limit: 30,
    rewrite_every_days: 7,
    rewrite_after_n_items: 10,
    wiki_dir: 'docs/wiki',
  },
  build: { out_dir: 'dist', search_index_max_bytes: 1024 * 1024 },
  retry: {
    max_attempts: 3,
    backoff_ms: [60000, 300000, 1500000],
    feed_unhealthy_after: 5,
    feed_disable_after: 20,
  },
};

export const MAX_LLM_CONCURRENCY = 8;

type Deep = Record<string, unknown>;

function isPlainObject(v: unknown): v is Deep {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 얕은 키는 덮어쓰고 객체는 재귀 병합한다. 배열은 통째로 교체한다. */
export function mergeDeep<T>(base: T, over: unknown): T {
  if (!isPlainObject(over)) return base;
  const out: Deep = { ...(base as unknown as Deep) };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined || v === null) continue;
    const cur = out[k];
    out[k] = isPlainObject(cur) && isPlainObject(v) ? mergeDeep(cur, v) : v;
  }
  return out as unknown as T;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function normalizeConfig(cfg: AppConfig): AppConfig {
  cfg.llm.concurrency = clamp(Math.floor(cfg.llm.concurrency) || 1, 1, MAX_LLM_CONCURRENCY);
  cfg.llm.rewrite_concurrency = clamp(
    Math.floor(cfg.llm.rewrite_concurrency) || 1,
    1,
    MAX_LLM_CONCURRENCY,
  );
  cfg.categories.seeds = cfg.categories.seeds.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!cfg.categories.seeds.includes('misc')) cfg.categories.seeds.push('misc');
  return cfg;
}

export function loadConfig(path = 'config/rss-wiki.yaml'): AppConfig {
  let raw: unknown = {};
  if (existsSync(path)) raw = parse(readFileSync(path, 'utf8')) ?? {};
  return normalizeConfig(mergeDeep(structuredClone(DEFAULT_CONFIG), raw));
}

export function loadFeeds(path = 'config/feeds.yaml'): FeedConfig[] {
  if (!existsSync(path)) return [];
  const raw = parse(readFileSync(path, 'utf8')) ?? {};
  const list = Array.isArray(raw?.feeds) ? raw.feeds : [];
  return list
    .filter((f: Record<string, unknown>) => typeof f?.url === 'string')
    .map((f: Record<string, unknown>) => ({
      url: String(f.url),
      name: typeof f.name === 'string' && f.name ? f.name : new URL(String(f.url)).hostname,
      seed_categories: Array.isArray(f.seed_categories) ? f.seed_categories.map(String) : [],
      enabled: f.enabled === undefined ? true : Boolean(f.enabled),
    }));
}
