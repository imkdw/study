/** 검색 API. FTS 래퍼 + 클라이언트용 search-index.json 빌더. */
import type { Db } from '../db/index.ts';
import type { FtsSearchHit } from './fts.ts';
import { searchFts } from './fts.ts';

export type { FtsSearchHit } from './fts.ts';

/** searchFts 래퍼. */
export function search(db: Db, q: string, limit?: number): FtsSearchHit[] {
  return searchFts(db, q, limit ?? 20);
}

/** 클라이언트 검색용 축약 엔트리 형태. */
export interface SearchIndexEntry {
  id: number;
  t: string;
  s: string;
  k: string[];
  e: string[];
  c: string | null;
  u: string;
  d: string | null;
}

interface SearchIndexRawRow {
  id: number;
  title: string;
  summary_ko: string;
  key_points_json: string;
  entities_json: string;
  url: string;
  published_at: string | null;
  category_slug: string | null;
}

function parseJsonArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function byteLength(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

const DEFAULT_MAX_BYTES = 1024 * 1024;

/**
 * 전체 요약을 클라이언트 검색 인덱스 JSON 으로 직렬화한다.
 * maxBytes 를 넘으면 key_points/entities 를 버리고 summary 를 160자로 잘라 축소하고,
 * 그래도 넘으면 최신순으로 유지하며 오래된 항목부터 잘라낸다.
 */
export function buildSearchIndex(
  db: Db,
  opts: { maxBytes?: number } = {},
): { json: string; entries: number; reduced: boolean } {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  const rows = db
    .prepare(
      `SELECT a.id AS id, a.title AS title, s.summary_ko AS summary_ko,
              s.key_points_json AS key_points_json, s.entities_json AS entities_json,
              a.url AS url, a.published_at AS published_at,
              (SELECT c.slug FROM article_categories ac
                 JOIN categories c ON c.id = ac.category_id
                WHERE ac.article_id = a.id
                ORDER BY ac.confidence DESC LIMIT 1) AS category_slug
       FROM summaries s
       JOIN articles a ON a.id = s.article_id
       ORDER BY a.published_at DESC, a.id DESC`,
    )
    .all() as unknown as SearchIndexRawRow[];

  let entries: SearchIndexEntry[] = rows.map((r) => ({
    id: r.id,
    t: r.title,
    s: r.summary_ko,
    k: parseJsonArray(r.key_points_json),
    e: parseJsonArray(r.entities_json),
    c: r.category_slug,
    u: r.url,
    d: r.published_at,
  }));

  let reduced = false;
  let json = JSON.stringify(entries);

  if (byteLength(json) > maxBytes) {
    reduced = true;
    entries = entries.map((e) => ({ ...e, k: [], e: [], s: e.s.slice(0, 160) }));
    json = JSON.stringify(entries);
  }

  if (byteLength(json) > maxBytes) {
    // 최신순(entries[0] 이 가장 최신)을 유지한 채, 앞에서부터 몇 개까지가
    // 상한 이하인지 이진 탐색으로 찾아 나머지(오래된 항목)를 잘라낸다.
    let lo = 0;
    let hi = entries.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = JSON.stringify(entries.slice(0, mid));
      if (byteLength(candidate) <= maxBytes) lo = mid;
      else hi = mid - 1;
    }
    entries = entries.slice(0, lo);
    json = JSON.stringify(entries);
  }

  return { json, entries: entries.length, reduced };
}
