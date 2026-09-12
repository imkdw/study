import { normalizeUrl, urlHash as sha256Url } from '../util/url.ts';
import { loadFeeds } from '../config.ts';
import { nowIso, bool } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import type { StageCtx } from '../stage.ts';
import { throwIfCancelled, ctxFetch, ctxNow } from '../stage.ts';
import type { AppConfig, FeedConfig, FeedHealth, ParsedItem } from '../types.ts';
import { fetchFeed } from './fetchFeed.ts';
import { parseFeed } from './feedParser.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const UNHEALTHY_RETRY_DAYS = 7;

interface FeedQueryRow {
  id: number;
  url: string;
  etag: string | null;
  last_modified: string | null;
  health: FeedHealth;
  last_fetched_at: string | null;
}


/** feeds.yaml 내용을 feeds 테이블에 url 기준 upsert 한다. etag/health 는 보존한다. */
export function syncFeeds(db: Db, feedConfigs: FeedConfig[]): void {
  const upsert = db.prepare(`
    INSERT INTO feeds (url, name, enabled, seed_categories)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      enabled = excluded.enabled,
      seed_categories = excluded.seed_categories
  `);
  for (const f of feedConfigs) {
    upsert.run(f.url, f.name, bool(f.enabled), JSON.stringify(f.seed_categories));
  }
}

/** 피드 실패 기록. 연속 실패 횟수에 따라 health 를 전이시킨다. */
export function recordFeedFailure(db: Db, feedId: number, cfg: AppConfig): void {
  const row = db.prepare('SELECT consecutive_failures FROM feeds WHERE id = ?').get(feedId) as
    | { consecutive_failures: number }
    | undefined;
  const failures = (row?.consecutive_failures ?? 0) + 1;
  let health: FeedHealth = 'healthy';
  if (failures >= cfg.retry.feed_disable_after) health = 'disabled';
  else if (failures >= cfg.retry.feed_unhealthy_after) health = 'unhealthy';
  db.prepare('UPDATE feeds SET consecutive_failures = ?, health = ? WHERE id = ?').run(
    failures,
    health,
    feedId,
  );
}

/** 피드 성공 기록. 실패 카운터를 리셋하고 etag/last_modified/last_fetched_at 을 갱신한다. */
export function recordFeedSuccess(
  db: Db,
  feedId: number,
  info: { etag: string | null; lastModified: string | null; fetchedAt: string },
): void {
  db.prepare(
    `UPDATE feeds SET
       consecutive_failures = 0,
       health = 'healthy',
       etag = COALESCE(?, etag),
       last_modified = COALESCE(?, last_modified),
       last_fetched_at = ?
     WHERE id = ?`,
  ).run(info.etag, info.lastModified, info.fetchedAt, feedId);
}

/** 최신순 정렬. published_at 이 없는 항목은 뒤로 보낸다. */
function sortByPublishedDesc(items: ParsedItem[]): ParsedItem[] {
  return items.slice().sort((a, b) => {
    if (a.published_at === b.published_at) return 0;
    if (a.published_at === null) return 1;
    if (b.published_at === null) return -1;
    return b.published_at.localeCompare(a.published_at);
  });
}

export async function collect(
  ctx: StageCtx,
): Promise<{ feedsOk: number; feedsFailed: number; articlesNew: number }> {
  const { db, cfg, log } = ctx;

  // feeds.yaml 동기화는 주입 가능하다 (테스트/통합 시 DB 피드만 쓰려면 skipFeedSync)
  if (!ctx.skipFeedSync) syncFeeds(db, loadFeeds(ctx.feedsPath));

  const allFeeds = db
    .prepare(
      `SELECT id, url, etag, last_modified, health, last_fetched_at
       FROM feeds
       WHERE enabled = 1 AND health != 'disabled'`,
    )
    .all() as unknown as FeedQueryRow[];

  const nowMs = ctxNow(ctx).getTime();
  const targets = allFeeds.filter((f) => {
    if (f.health !== 'unhealthy') return true;
    if (!f.last_fetched_at) return true;
    const lastFetchedMs = new Date(f.last_fetched_at).getTime();
    if (Number.isNaN(lastFetchedMs)) return true;
    return nowMs - lastFetchedMs >= UNHEALTHY_RETRY_DAYS * DAY_MS;
  });

  const feedCount = targets.length;
  ctx.onProgress?.('collect', 0, feedCount);

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO articles
      (feed_id, guid, url, normalized_url, url_hash, title, author, published_at,
       raw_content, content_source, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'discovered', ?, ?)
  `);
  const countStmt = db.prepare('SELECT COUNT(*) AS c FROM articles WHERE feed_id = ?');

  let feedsOk = 0;
  let feedsFailed = 0;
  let articlesNew = 0;
  let done = 0;
  let capped = false;

  for (const feed of targets) {
    throwIfCancelled(ctx);

    if (capped) break;

    try {
      const result = await fetchFeed(feed.url, {
        etag: feed.etag,
        lastModified: feed.last_modified,
        fetchImpl: ctxFetch(ctx),
        timeoutMs: cfg.collect.fetch_timeout_ms,
        userAgent: cfg.extract.user_agent,
      });

      const fetchedAt = ctxNow(ctx).toISOString();

      if (result.notModified) {
        recordFeedSuccess(db, feed.id, {
          etag: null,
          lastModified: null,
          fetchedAt,
        });
        feedsOk++;
      } else {
        const parsed = parseFeed(result.body ?? '');

        const existingCount = (countStmt.get(feed.id) as { c: number }).c;
        const isFirstCollection = existingCount === 0;

        let candidates = parsed.items;
        if (isFirstCollection) {
          candidates = sortByPublishedDesc(candidates).slice(0, cfg.collect.backfill_limit);
        }

        for (const item of candidates) {
          if (articlesNew >= cfg.collect.max_articles_per_run) {
            capped = true;
            break;
          }
          if (!item.url) continue;

          const normalizedUrl = normalizeUrl(item.url, cfg.dedupe.strip_query_params);
          const urlHash = sha256Url(normalizedUrl);
          const created = nowIso();

          const insertResult = insertStmt.run(
            feed.id,
            item.guid,
            item.url,
            normalizedUrl,
            urlHash,
            item.title,
            item.author,
            item.published_at,
            item.content ?? item.summary,
            created,
            created,
          );

          if (insertResult.changes > 0) articlesNew++;
        }

        recordFeedSuccess(db, feed.id, {
          etag: result.etag,
          lastModified: result.lastModified,
          fetchedAt,
        });
        feedsOk++;
      }
    } catch (e) {
      log.warn('피드 수집 실패', { url: feed.url, error: (e as Error).message });
      recordFeedFailure(db, feed.id, cfg);
      feedsFailed++;
    }

    done++;
    ctx.onProgress?.('collect', done, feedCount);
  }

  return { feedsOk, feedsFailed, articlesNew };
}
