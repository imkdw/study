/** 공용 도메인 타입. 모든 모듈이 이 파일의 계약을 따른다. */

// ---------- 설정 ----------

export interface FeedConfig {
  url: string;
  name: string;
  seed_categories: string[];
  enabled: boolean;
}

export interface AppConfig {
  schedule: string;
  timezone: string;
  dbPath: string;
  collect: {
    backfill_limit: number;
    max_articles_per_run: number;
    /** 피드 fetch 타임아웃. 원문 fetch(extract) 와 별개로 조정한다. */
    fetch_timeout_ms: number;
  };
  extract: {
    rss_content_min_length: number;
    fetch_timeout_ms: number;
    rate_limit_per_domain_rps: number;
    max_content_chars: number;
    user_agent: string;
  };
  dedupe: {
    title_similarity_threshold: number;
    strip_query_params: string[];
  };
  llm: {
    runner: string;
    claude_bin: string;
    summarize_model: string;
    rewrite_model: string;
    concurrency: number;
    rewrite_concurrency: number;
    call_timeout_ms: number;
    backoff_on_rate_limit_ms: number[];
    daily_budget_usd: number;
    language: string;
  };
  server: {
    port: number;
    host: string;
    enable_manual_run: boolean;
    stale_job_timeout_ms: number;
  };
  categories: {
    seeds: string[];
    promote_after: number;
    low_confidence_threshold: number;
  };
  compose: {
    timeline_limit: number;
    rewrite_every_days: number;
    rewrite_after_n_items: number;
    wiki_dir: string;
  };
  build: {
    out_dir: string;
    search_index_max_bytes: number;
  };
  retry: {
    max_attempts: number;
    backoff_ms: number[];
    feed_unhealthy_after: number;
    feed_disable_after: number;
  };
}

// ---------- 피드 / 글 ----------

export type FeedHealth = 'healthy' | 'unhealthy' | 'disabled';

export interface FeedRow {
  id: number;
  url: string;
  name: string;
  enabled: number;
  etag: string | null;
  last_modified: string | null;
  consecutive_failures: number;
  health: FeedHealth;
  last_fetched_at: string | null;
  seed_categories: string;
}

export type ContentSource = 'rss' | 'fetched' | 'rss_fallback';

export type ArticleStatus =
  | 'discovered'
  | 'fetched'
  | 'summarized'
  | 'published'
  | 'failed'
  | 'dead_letter';

export type FailedReason =
  | 'network'
  | 'parse'
  | 'llm_error'
  | 'llm_refusal'
  | 'timeout';

export interface ArticleRow {
  id: number;
  feed_id: number;
  guid: string | null;
  url: string;
  normalized_url: string;
  url_hash: string;
  title: string;
  author: string | null;
  published_at: string | null;
  raw_content: string | null;
  content_source: ContentSource | null;
  cluster_id: number | null;
  status: ArticleStatus;
  retry_count: number;
  next_retry_at: string | null;
  failed_reason: FailedReason | null;
  created_at: string;
  updated_at: string;
}

/** 피드 파서가 돌려주는 정규화된 항목 */
export interface ParsedItem {
  guid: string | null;
  url: string;
  title: string;
  author: string | null;
  published_at: string | null;
  content: string | null;
  summary: string | null;
}

export interface ParsedFeed {
  title: string | null;
  items: ParsedItem[];
}

// ---------- LLM ----------

export interface EnrichResult {
  summary_ko: string;
  one_liner_ko: string;
  category: string;
  is_new_category: boolean;
  confidence: number;
  key_points: string[];
  entities: string[];
}

export interface ClaudeRunOptions {
  bin: string;
  model: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** 테스트 주입용. 지정하면 실제 프로세스를 띄우지 않는다. */
  spawnImpl?: SpawnImpl;
}

export type SpawnImpl = (
  bin: string,
  args: string[],
  stdin: string,
  timeoutMs: number,
  signal?: AbortSignal,
) => Promise<{ code: number; stdout: string; stderr: string }>;

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface ClaudeResponse {
  text: string;
  usage: ClaudeUsage;
}

export class RateLimitError extends Error {
  readonly kind = 'rate_limit';
}
export class UsageLimitError extends Error {
  readonly kind = 'usage_limit';
}
export class LlmTimeoutError extends Error {
  readonly kind = 'timeout';
}

// ---------- 잡 / 진행 상황 ----------

export const STAGES = [
  'collect',
  'extract',
  'dedupe',
  'enrich',
  'compose',
  'build',
] as const;
export type Stage = (typeof STAGES)[number];

export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export type RunStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'stale';

export type RunTrigger = 'cron' | 'manual';

export interface StageProgress {
  status: StageStatus;
  done?: number;
  total?: number;
  error?: string | null;
}

export interface RunProgress {
  runId: string;
  status: RunStatus;
  stage: Stage | null;
  stages: Record<Stage, StageProgress>;
  startedAt: string | null;
  elapsedMs: number;
  /** 스테이지 오류 + 피드 실패 + 글 실패의 합. UI 가 이 값 하나로 실패 여부를 판단한다. */
  errors: number;
  /** 실패 내역 분해 (스테이지 / 피드 / 글) */
  errorBreakdown?: { stages: number; feeds: number; articles: number };
  articlesNew?: number;
  pagesUpdated?: number;
}

// ---------- compose ----------

export interface TimelineItem {
  date: string;
  title: string;
  one_liner: string;
  sources: { name: string; url: string }[];
}

export interface PageData {
  slug: string;
  name: string;
  updatedAt: string;
  itemCount: number;
  feedCount: number;
  weekRange: string;
  weekHighlights: string[];
  narrative: string;
  timeline: TimelineItem[];
  related: string[];
  sources: string[];
}
