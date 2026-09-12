/**
 * M4 compose 스테이지.
 * DB 상태로부터 결정적으로 위키 페이지 데이터를 조립하고,
 * 증분 갱신 / 전체 재작성 / 아카이빙 / index.md 생성을 수행한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '../db/index.ts';
import { nowIso } from '../db/index.ts';
import type { StageCtx } from '../stage.ts';
import { ctxNow, throwIfCancelled } from '../stage.ts';
import type { AppConfig, PageData, TimelineItem } from '../types.ts';
import { renderArchive, renderIndex, renderPage, parsePage, slugToPath } from './render.ts';
import type { ArchiveLink, IndexPageEntry } from './render.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- 재작성 주입점 ----------

export type RewriteFn = (
  page: PageData,
) => Promise<{ narrative: string; related: string[]; week_highlights: string[] }>;

export interface ComposeOptions {
  rewriteAll?: boolean;
  rewriteFn?: RewriteFn;
}

// ---------- 작은 동시성 제한 헬퍼 ----------

/** items 를 fn 으로 처리하되 동시 실행 수를 limit 으로 제한한다. */
async function runLimited<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

// ---------- 날짜 포맷 (UTC 고정: 테스트/호스트 타임존에 무관하게 결정적) ----------

function formatDateUTC(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mdLabel(ymd: string): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

// ---------- pages 테이블 확장 컬럼 ----------
// schema.sql (다른 모듈 소유, 수정 금지) 에는 narrative 까지만 있다.
// related / week_highlights 는 재작성 산출물을 보존하기 위해 이 모듈이 필요로 하는 컬럼이므로
// 여기서 멱등적으로 ALTER TABLE 한다 (schema.sql 자체는 건드리지 않는다).
function ensurePagesColumns(db: Db): void {
  const cols = db.prepare('PRAGMA table_info(pages)').all() as unknown as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('related_json')) {
    db.exec("ALTER TABLE pages ADD COLUMN related_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!names.has('week_highlights_json')) {
    db.exec("ALTER TABLE pages ADD COLUMN week_highlights_json TEXT NOT NULL DEFAULT '[]'");
  }
}

interface PagesRow {
  item_count: number;
  last_incremental_at: string | null;
  last_rewrite_at: string | null;
  items_since_rewrite: number;
  narrative: string;
  related_json: string;
  week_highlights_json: string;
}

function getPagesRow(db: Db, categoryId: number): PagesRow | undefined {
  return db
    .prepare(
      `SELECT item_count, last_incremental_at, last_rewrite_at, items_since_rewrite,
              narrative, related_json, week_highlights_json
       FROM pages WHERE category_id = ?`,
    )
    .get(categoryId) as unknown as PagesRow | undefined;
}

function insertPagesRow(
  db: Db,
  categoryId: number,
  path: string,
  itemCount: number,
  lastIncrementalAt: string | null,
  itemsSinceRewrite: number,
  narrative: string,
  related: string[],
  weekHighlights: string[],
): void {
  db.prepare(
    `INSERT INTO pages
       (category_id, path, item_count, last_incremental_at, items_since_rewrite,
        narrative, related_json, week_highlights_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    categoryId,
    path,
    itemCount,
    lastIncrementalAt,
    itemsSinceRewrite,
    narrative,
    JSON.stringify(related),
    JSON.stringify(weekHighlights),
  );
}

function updatePagesRowCounts(
  db: Db,
  categoryId: number,
  path: string,
  itemCount: number,
  lastIncrementalAt: string | null,
  itemsSinceRewrite: number,
): void {
  db.prepare(
    `UPDATE pages SET path = ?, item_count = ?, last_incremental_at = ?, items_since_rewrite = ?
     WHERE category_id = ?`,
  ).run(path, itemCount, lastIncrementalAt, itemsSinceRewrite, categoryId);
}

// ---------- 타임라인 항목 조립 ----------

interface CategoryItemRow {
  id: number;
  cluster_id: number | null;
  title: string;
  published_at: string | null;
  created_at: string;
  url: string;
  feed_name: string;
  one_liner_ko: string;
}

/**
 * 카테고리에 배정된 전체 타임라인 항목을 최신순(published_at DESC, id DESC)으로 반환한다.
 * 클러스터에 속한 글은 canonical(=enrich 로 카테고리가 배정된 글)만 항목이 되고,
 * 같은 cluster_id 를 공유하는 나머지 글들의 피드/URL 은 sources 로 함께 실린다.
 */
function loadItems(db: Db, categoryId: number): TimelineItem[] {
  const rows = db
    .prepare(
      `SELECT a.id, a.cluster_id, a.title, a.published_at, a.created_at, a.url,
              f.name AS feed_name, s.one_liner_ko
       FROM article_categories ac
       JOIN articles a ON a.id = ac.article_id
       JOIN summaries s ON s.article_id = a.id
       JOIN feeds f ON f.id = a.feed_id
       WHERE ac.category_id = ? AND a.status IN ('summarized', 'published')
       ORDER BY (a.published_at IS NULL) ASC, a.published_at DESC, a.id DESC`,
    )
    .all(categoryId) as unknown as CategoryItemRow[];

  const siblingsStmt = db.prepare(
    `SELECT a.url AS url, f.name AS feed_name
     FROM articles a JOIN feeds f ON f.id = a.feed_id
     WHERE a.cluster_id = ?
     ORDER BY a.id ASC`,
  );

  return rows.map((row) => {
    let sources: { name: string; url: string }[];
    if (row.cluster_id != null) {
      const siblings = siblingsStmt.all(row.cluster_id) as unknown as {
        url: string;
        feed_name: string;
      }[];
      sources = siblings.map((s) => ({ name: s.feed_name, url: s.url }));
    } else {
      sources = [{ name: row.feed_name, url: row.url }];
    }
    return {
      date: formatDateUTC(row.published_at ?? row.created_at),
      title: row.title,
      one_liner: row.one_liner_ko,
      sources,
    };
  });
}

function archiveLinksFor(slug: string, overflow: TimelineItem[]): ArchiveLink[] {
  const years = new Set(overflow.map((it) => (it.date ? it.date.slice(0, 4) : 'unknown')));
  return Array.from(years).map((year) => ({ year, path: `archive/${slug}-${year}.md` }));
}

/**
 * 타임라인 초과분을 연도별 아카이브 파일로 내보낸다.
 * 내용이 이미 같으면 쓰지 않고, 이번 실행에서 실제로 새로 아카이브된 항목 수만 돌려준다.
 * (변경이 없는데도 매번 "아카이브 N건" 을 보고하지 않게 하기 위한 것)
 */
function writeArchiveFiles(
  wikiDir: string,
  slug: string,
  name: string,
  overflow: TimelineItem[],
): number {
  const groups = new Map<string, TimelineItem[]>();
  for (const it of overflow) {
    const year = it.date ? it.date.slice(0, 4) : 'unknown';
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(it);
  }

  let newlyArchived = 0;
  for (const [year, items] of groups) {
    const path = join(wikiDir, 'archive', `${slug}-${year}.md`);
    const rendered = renderArchive(slug, name, year, items);
    const prev = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (prev === rendered) continue;
    writeFileSync(path, rendered);
    newlyArchived += items.length;
  }
  return newlyArchived;
}

/** 렌더 결과가 디스크와 다를 때만 쓴다. 같은 사이클 재실행이 파일을 건드리지 않게 한다. */
function writeIfChanged(path: string, content: string): boolean {
  const prev = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (prev === content) return false;
  writeFileSync(path, content);
  return true;
}

// ---------- 페이지 데이터 조립 ----------

/** DB 상태로부터 결정적으로 PageData 를 파생한다. */
export function buildPageData(db: Db, cfg: AppConfig, categoryId: number, now: Date): PageData {
  ensurePagesColumns(db);

  const cat = db.prepare('SELECT slug, name FROM categories WHERE id = ?').get(categoryId) as
    unknown as { slug: string; name: string } | undefined;
  if (!cat) throw new Error(`알 수 없는 카테고리 id: ${categoryId}`);

  const items = loadItems(db, categoryId);
  const itemCount = items.length;
  const timeline = items.slice(0, cfg.compose.timeline_limit);

  const nowStr = formatDateUTC(now.toISOString());
  const weekStartStr = formatDateUTC(new Date(now.getTime() - 6 * DAY_MS).toISOString());
  const weekRange = `${mdLabel(weekStartStr)}~${mdLabel(nowStr)}`;

  const pageRow = getPagesRow(db, categoryId);

  let narrative = pageRow?.narrative ?? '';
  if (!narrative) {
    const filePath = slugToPath(cfg.compose.wiki_dir, cat.slug);
    if (existsSync(filePath)) {
      narrative = parsePage(readFileSync(filePath, 'utf8')).narrative ?? '';
    }
  }

  const related: string[] = pageRow?.related_json ? JSON.parse(pageRow.related_json) : [];
  let weekHighlights: string[] = pageRow?.week_highlights_json
    ? JSON.parse(pageRow.week_highlights_json)
    : [];
  if (weekHighlights.length === 0) {
    weekHighlights = items
      .filter((it) => it.date && it.date >= weekStartStr && it.date <= nowStr)
      .slice(0, 3)
      .map((it) => it.one_liner);
  }

  const feedNames = new Set<string>();
  for (const it of items) for (const s of it.sources) feedNames.add(s.name);
  const sources = Array.from(feedNames).sort((a, b) => a.localeCompare(b));

  return {
    slug: cat.slug,
    name: cat.name,
    updatedAt: nowStr,
    itemCount,
    feedCount: sources.length,
    weekRange,
    weekHighlights,
    narrative,
    timeline,
    related,
    sources,
  };
}

// ---------- index.md ----------

function writeIndexFile(db: Db, cfg: AppConfig, now: Date, categoryIds: number[]): void {
  const entries: IndexPageEntry[] = categoryIds.map((id) => {
    const pd = buildPageData(db, cfg, id, now);
    return {
      slug: pd.slug,
      name: pd.name,
      itemCount: pd.itemCount,
      updatedAt: pd.updatedAt,
      highlights: pd.weekHighlights,
    };
  });
  const updatedAt = formatDateUTC(now.toISOString());
  writeIfChanged(join(cfg.compose.wiki_dir, 'index.md'), renderIndex(entries, updatedAt));
}

// ---------- compose 본체 ----------

export async function compose(
  ctx: StageCtx,
  opts: ComposeOptions = {},
): Promise<{ pagesUpdated: number; rewritten: number; archived: number }> {
  const { db, cfg, log } = ctx;
  ensurePagesColumns(db);

  const now = ctxNow(ctx);
  const wikiDir = cfg.compose.wiki_dir;
  mkdirSync(wikiDir, { recursive: true });
  mkdirSync(join(wikiDir, 'archive'), { recursive: true });

  const categories = db
    .prepare(`SELECT id, slug, name FROM categories WHERE status = 'active' ORDER BY id ASC`)
    .all() as unknown as { id: number; slug: string; name: string }[];

  const updatedSet = new Set<number>();
  let archivedTotal = 0;
  const rewriteCandidates: { id: number; slug: string }[] = [];
  const categoryIdsWithPages: number[] = [];

  const total = categories.length;
  let done = 0;

  for (const cat of categories) {
    throwIfCancelled(ctx);

    const fullItems = loadItems(db, cat.id);
    if (fullItems.length === 0) {
      // 항목 0개 카테고리는 페이지를 만들지 않는다.
      done++;
      ctx.onProgress?.('compose', done, total);
      continue;
    }

    const existing = getPagesRow(db, cat.id);
    const isNewPage = !existing;
    const prevCount = existing?.item_count ?? 0;
    const newItemsCount = Math.max(0, fullItems.length - prevCount);
    const needsIncremental = isNewPage || newItemsCount > 0;
    const itemsSinceRewrite = (existing?.items_since_rewrite ?? 0) + newItemsCount;

    const overflow = fullItems.slice(cfg.compose.timeline_limit);
    if (overflow.length > 0) {
      archivedTotal += writeArchiveFiles(wikiDir, cat.slug, cat.name, overflow);
    }

    const path = slugToPath(wikiDir, cat.slug);

    // 페이지는 항상 렌더해서 디스크와 비교한다. 그래야 타임라인 절삭과 아카이브 링크가
    // 새 항목이 없는 사이클에도 반영된다. narrative 는 재작성 단계에서만 바뀐다.
    const pageData: PageData = buildPageData(db, cfg, cat.id, now);
    const wrote = writeIfChanged(
      path,
      renderPage(pageData, { archiveLinks: archiveLinksFor(cat.slug, overflow) }),
    );
    if (needsIncremental || wrote) updatedSet.add(cat.id);

    if (isNewPage) {
      insertPagesRow(
        db,
        cat.id,
        path,
        fullItems.length,
        needsIncremental ? nowIso() : null,
        itemsSinceRewrite,
        pageData.narrative,
        pageData.related,
        pageData.weekHighlights,
      );
    } else {
      updatePagesRowCounts(
        db,
        cat.id,
        path,
        fullItems.length,
        needsIncremental ? nowIso() : (existing!.last_incremental_at ?? null),
        itemsSinceRewrite,
      );
    }

    const daysSinceRewrite = existing?.last_rewrite_at
      ? (now.getTime() - new Date(existing.last_rewrite_at).getTime()) / DAY_MS
      : Infinity;
    const needsRewrite =
      Boolean(opts.rewriteAll) ||
      daysSinceRewrite >= cfg.compose.rewrite_every_days ||
      itemsSinceRewrite >= cfg.compose.rewrite_after_n_items;

    if (needsRewrite && opts.rewriteFn) {
      rewriteCandidates.push({ id: cat.id, slug: cat.slug });
    }

    categoryIdsWithPages.push(cat.id);
    done++;
    ctx.onProgress?.('compose', done, total);
  }

  // 전체 재작성: rewriteFn 이 있을 때만, 동시 실행 수는 cfg.llm.rewrite_concurrency 로 제한.
  let rewritten = 0;
  if (opts.rewriteFn && rewriteCandidates.length > 0) {
    const rewriteFn = opts.rewriteFn;
    await runLimited(
      rewriteCandidates,
      async (cand) => {
        throwIfCancelled(ctx);
        const pageData = buildPageData(db, cfg, cand.id, now);
        try {
          const result = await rewriteFn(pageData);
          const merged: PageData = {
            ...pageData,
            narrative: result.narrative,
            related: result.related,
            weekHighlights: result.week_highlights,
          };
          const overflow = loadItems(db, cand.id).slice(cfg.compose.timeline_limit);
          const path = slugToPath(wikiDir, cand.slug);
          writeIfChanged(
            path,
            renderPage(merged, { archiveLinks: archiveLinksFor(cand.slug, overflow) }),
          );
          db.prepare(
            `UPDATE pages
             SET narrative = ?, related_json = ?, week_highlights_json = ?,
                 last_rewrite_at = ?, items_since_rewrite = 0
             WHERE category_id = ?`,
          ).run(
            result.narrative,
            JSON.stringify(result.related),
            JSON.stringify(result.week_highlights),
            nowIso(),
            cand.id,
          );
          updatedSet.add(cand.id);
          rewritten++;
        } catch (e) {
          // 재작성 실패: 직전 버전 파일을 그대로 유지한다. 로그만 남기고 다음 페이지로 넘어간다.
          log.warn('위키 페이지 재작성 실패', { slug: cand.slug, error: (e as Error).message });
        }
      },
      cfg.llm.rewrite_concurrency,
    );
  }

  writeIndexFile(db, cfg, now, categoryIdsWithPages);

  return { pagesUpdated: updatedSet.size, rewritten, archived: archivedTotal };
}
