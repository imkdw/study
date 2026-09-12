PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS feeds (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  etag TEXT,
  last_modified TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  health TEXT NOT NULL DEFAULT 'healthy',
  last_fetched_at TEXT,
  seed_categories TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS clusters (
  id INTEGER PRIMARY KEY,
  canonical_article_id INTEGER,
  title_normalized TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY,
  feed_id INTEGER NOT NULL REFERENCES feeds(id),
  guid TEXT,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  url_hash TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  published_at TEXT,
  raw_content TEXT,
  content_source TEXT,
  cluster_id INTEGER REFERENCES clusters(id),
  status TEXT NOT NULL DEFAULT 'discovered',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  failed_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_cluster ON articles(cluster_id);

CREATE TABLE IF NOT EXISTS summaries (
  article_id INTEGER PRIMARY KEY REFERENCES articles(id),
  summary_ko TEXT NOT NULL,
  one_liner_ko TEXT NOT NULL,
  key_points_json TEXT NOT NULL DEFAULT '[]',
  entities_json TEXT NOT NULL DEFAULT '[]',
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_seed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  pending_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS article_categories (
  article_id INTEGER NOT NULL REFERENCES articles(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  confidence REAL NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, category_id)
);

CREATE TABLE IF NOT EXISTS pages (
  category_id INTEGER PRIMARY KEY REFERENCES categories(id),
  path TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  last_incremental_at TEXT,
  last_rewrite_at TEXT,
  items_since_rewrite INTEGER NOT NULL DEFAULT 0,
  narrative TEXT NOT NULL DEFAULT '',
  related_json TEXT NOT NULL DEFAULT '[]',
  week_highlights_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT,
  started_at TEXT,
  finished_at TEXT,
  heartbeat_at TEXT,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  feeds_ok INTEGER NOT NULL DEFAULT 0,
  feeds_failed INTEGER NOT NULL DEFAULT 0,
  articles_new INTEGER NOT NULL DEFAULT 0,
  articles_failed INTEGER NOT NULL DEFAULT 0,
  pages_updated INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- PRD 7절은 ON runs(status) 였으나 그러면 queued 1개 + running 1개가 공존한다.
-- "동시에 도는 수집 잡은 1개" 를 실제로 강제하려고 상수식 인덱스로 바꿨다.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_run
  ON runs ((1)) WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS run_stages (
  run_id TEXT NOT NULL REFERENCES runs(id),
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  done INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  finished_at TEXT,
  error TEXT,
  PRIMARY KEY (run_id, stage)
);

CREATE TABLE IF NOT EXISTS budget_usage (
  day TEXT PRIMARY KEY,
  cost_usd REAL NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0
);

CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  title, summary_ko, key_points, entities,
  content='', tokenize='unicode61'
);
