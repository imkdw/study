/** SQLite FTS5 인덱싱. articles_fts 는 contentless(content='') 테이블이므로
 * 항상 rowid 를 명시해서 넣고, 갱신은 전체 재인덱싱 전략을 쓴다. */
import type { Db } from '../db/index.ts';

interface SummaryJoinRow {
  article_id: number;
  title: string;
  summary_ko: string;
  key_points_json: string;
  entities_json: string;
}

interface FtsRawRow {
  article_id: number;
  title: string;
  snippet: string;
}

interface CategorySlugRow {
  slug: string;
}

export interface FtsSearchHit {
  articleId: number;
  title: string;
  snippet: string;
  category: string | null;
  pageSlug: string | null;
}

/** JSON 배열 문자열을 공백으로 조인한 검색용 문자열로 바꾼다. */
function joinJsonArray(json: string): string {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String).join(' ') : '';
  } catch {
    return '';
  }
}

/** summaries + articles 를 조인해 articles_fts 를 전체 재구축한다. 반환값은 인덱싱된 행 수. */
export function reindexFts(db: Db): number {
  db.exec(`INSERT INTO articles_fts(articles_fts) VALUES('delete-all')`);

  const rows = db
    .prepare(
      `SELECT a.id AS article_id, a.title AS title, s.summary_ko AS summary_ko,
              s.key_points_json AS key_points_json, s.entities_json AS entities_json
       FROM summaries s
       JOIN articles a ON a.id = s.article_id`,
    )
    .all() as unknown as SummaryJoinRow[];

  const insert = db.prepare(
    `INSERT INTO articles_fts(rowid, title, summary_ko, key_points, entities)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const row of rows) {
    insert.run(
      row.article_id,
      row.title,
      row.summary_ko,
      joinJsonArray(row.key_points_json),
      joinJsonArray(row.entities_json),
    );
  }

  return rows.length;
}

/** FTS5 특수문자(", *, - 등)에 안전하도록 각 토큰을 큰따옴표 phrase 쿼리로 감싼다. */
function escapeFtsToken(token: string): string {
  return `"${token.replace(/"/g, '""')}"`;
}

/**
 * 각 토큰을 접두 검색(`"토큰"*`)으로 만든다.
 * 한국어는 조사가 붙어 "마이그레이션을" 같은 한 덩어리로 토큰화되기 때문에
 * 정확 일치만 쓰면 "마이그레이션" 질의가 아무것도 못 찾는다.
 */
function buildMatchQuery(query: string): string | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `${escapeFtsToken(t)}*`).join(' OR ');
}

/** 질의 토큰 주변을 잘라 스니펫을 만든다. contentless FTS5 라 snippet() 이 못 쓰는 것을 대신한다. */
function buildSnippet(text: string, tokens: string[], radius = 40): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return '';

  const lower = flat.toLowerCase();
  let hit = -1;
  for (const t of tokens) {
    const idx = lower.indexOf(t.toLowerCase());
    if (idx !== -1 && (hit === -1 || idx < hit)) hit = idx;
  }

  if (hit === -1) {
    return flat.length <= radius * 2 ? flat : `${flat.slice(0, radius * 2)}...`;
  }

  const start = Math.max(0, hit - radius);
  const end = Math.min(flat.length, hit + radius);
  return `${start > 0 ? '...' : ''}${flat.slice(start, end)}${end < flat.length ? '...' : ''}`;
}

/** articles_fts 에서 검색하고 소속 주제 슬러그를 붙여 반환한다. */
export function searchFts(db: Db, query: string, limit = 20): FtsSearchHit[] {
  const matchQuery = buildMatchQuery(query);
  if (!matchQuery) return [];

  const queryTokens = query.trim().split(/\s+/).filter(Boolean);

  let rows: FtsRawRow[];
  try {
    rows = db
      .prepare(
        `SELECT articles_fts.rowid AS article_id, a.title AS title,
                COALESCE(s.summary_ko, '') AS snippet
         FROM articles_fts
         JOIN articles a ON a.id = articles_fts.rowid
         LEFT JOIN summaries s ON s.article_id = articles_fts.rowid
         WHERE articles_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(matchQuery, limit) as unknown as FtsRawRow[];
  } catch {
    // FTS5 쿼리 파싱에 실패해도 검색은 예외 없이 빈 결과를 돌려준다.
    return [];
  }

  const categoryStmt = db.prepare(
    `SELECT c.slug AS slug
     FROM article_categories ac
     JOIN categories c ON c.id = ac.category_id
     WHERE ac.article_id = ?
     ORDER BY ac.confidence DESC
     LIMIT 1`,
  );

  return rows.map((row) => {
    const catRow = categoryStmt.get(row.article_id) as CategorySlugRow | undefined;
    const slug = catRow?.slug ?? null;
    return {
      articleId: row.article_id,
      title: row.title,
      snippet: buildSnippet(row.snippet ?? '', queryTokens),
      category: slug,
      pageSlug: slug,
    };
  });
}
