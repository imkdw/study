/** extract 스테이지: discovered 글의 본문을 확보한다 (PRD 5.2). */

import type { StageCtx } from '../stage.ts';
import { ctxFetch, ctxNow, throwIfCancelled } from '../stage.ts';
import type { ArticleRow, ContentSource } from '../types.ts';
import { extractReadable, htmlToText } from './readable.ts';
import { DomainRateLimiter, RobotsCache } from './guard.ts';

async function fetchAndExtract(
  ctx: StageCtx,
  url: string,
  timeoutMs: number,
  userAgent: string,
  maxChars: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await ctxFetch(ctx)(url, {
      signal: controller.signal,
      headers: { 'User-Agent': userAgent },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = extractReadable(html, maxChars);
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function extract(
  ctx: StageCtx,
): Promise<{ ok: number; failed: number; fallback: number }> {
  const { db, cfg, log } = ctx;

  const rows = db
    .prepare(`SELECT * FROM articles WHERE status = 'discovered'`)
    .all() as unknown as ArticleRow[];
  const total = rows.length;
  let done = 0;
  let ok = 0;
  let failed = 0;
  let fallback = 0;

  const limiter = new DomainRateLimiter(cfg.extract.rate_limit_per_domain_rps);
  const robots = new RobotsCache({
    fetchImpl: ctxFetch(ctx),
    userAgent: cfg.extract.user_agent,
    timeoutMs: cfg.extract.fetch_timeout_ms,
  });

  const updateStmt = db.prepare(
    `UPDATE articles SET raw_content = ?, content_source = ?, status = ?, failed_reason = ?, updated_at = ? WHERE id = ?`,
  );

  for (const row of rows) {
    throwIfCancelled(ctx);

    try {
      const rssText = htmlToText(row.raw_content ?? '');
      let finalContent: string;
      let source: ContentSource;

      if (rssText.length >= cfg.extract.rss_content_min_length) {
        finalContent = rssText;
        source = 'rss';
      } else {
        let fetched: string | null = null;
        const allowed = await robots.isAllowed(row.url);
        if (allowed) {
          await limiter.acquire(row.url);
          fetched = await fetchAndExtract(
            ctx,
            row.url,
            cfg.extract.fetch_timeout_ms,
            cfg.extract.user_agent,
            cfg.extract.max_content_chars,
          );
        }

        if (fetched && fetched.length > rssText.length) {
          finalContent = fetched;
          source = 'fetched';
        } else {
          finalContent = rssText;
          source = 'rss_fallback';
        }
      }

      const truncated = finalContent.slice(0, cfg.extract.max_content_chars).trim();

      if (!truncated) {
        updateStmt.run(row.raw_content, null, 'failed', 'parse', ctxNow(ctx).toISOString(), row.id);
        failed++;
      } else {
        updateStmt.run(truncated, source, 'fetched', null, ctxNow(ctx).toISOString(), row.id);
        ok++;
        if (source === 'rss_fallback') fallback++;
      }
    } catch (e) {
      log.warn('extract 처리 실패', { id: row.id, error: String(e) });
      failed++;
      try {
        updateStmt.run(row.raw_content, null, 'failed', 'parse', ctxNow(ctx).toISOString(), row.id);
      } catch {
        /* DB 갱신조차 실패하면 다음 글로 넘어간다 */
      }
    } finally {
      done++;
      ctx.onProgress?.('extract', done, total);
    }
  }

  return { ok, failed, fallback };
}
