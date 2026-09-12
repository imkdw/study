/** dedupe 스테이지: URL 해시 동일 판정 + 제목 유사도 클러스터링 (PRD 5.3). */

import type { StageCtx } from '../stage.ts';
import { ctxNow, throwIfCancelled } from '../stage.ts';
import type { ArticleRow } from '../types.ts';
import { normalizeUrl, urlHash } from '../util/url.ts';
import { clusterTitles } from '../util/similarity.ts';

/** 정렬용 키: 발행일 우선, 없으면 생성일. */
function sortKey(r: ArticleRow): string {
  return r.published_at ?? r.created_at;
}

function isOlder(a: ArticleRow, b: ArticleRow): boolean {
  return sortKey(a) <= sortKey(b);
}

function createCluster(db: StageCtx['db'], ctx: StageCtx, canonical: ArticleRow): number {
  const result = db
    .prepare(`INSERT INTO clusters (canonical_article_id, title_normalized, created_at) VALUES (?, ?, ?)`)
    .run(canonical.id, canonical.title, ctxNow(ctx).toISOString());
  return Number(result.lastInsertRowid);
}

function assignCluster(db: StageCtx['db'], ctx: StageCtx, articleId: number, clusterId: number): void {
  db.prepare(`UPDATE articles SET cluster_id = ?, updated_at = ? WHERE id = ?`).run(
    clusterId,
    ctxNow(ctx).toISOString(),
    articleId,
  );
}

export async function dedupe(ctx: StageCtx): Promise<{ clusters: number; duplicates: number }> {
  const { db, cfg } = ctx;
  let newClusters = 0;
  let duplicates = 0;

  const candidates = db
    .prepare(`SELECT * FROM articles WHERE status = 'fetched' AND cluster_id IS NULL`)
    .all() as unknown as ArticleRow[];

  // 1) URL 정규화/해시 재계산 + 충돌 병합 (기존 값이 비었거나 구버전인 경우만)
  for (const row of candidates) {
    throwIfCancelled(ctx);
    if (row.normalized_url && row.url_hash) continue;

    const normalized = normalizeUrl(row.url, cfg.dedupe.strip_query_params);
    const hash = urlHash(normalized);

    const conflict = db
      .prepare(`SELECT * FROM articles WHERE url_hash = ? AND id != ?`)
      .get(hash, row.id) as ArticleRow | undefined;

    if (conflict) {
      const older = isOlder(conflict, row) ? conflict : row;
      const newer = older === conflict ? row : conflict;

      let clusterId = older.cluster_id;
      if (!clusterId) {
        clusterId = createCluster(db, ctx, older);
        newClusters++;
        assignCluster(db, ctx, older.id, clusterId);
      }
      assignCluster(db, ctx, newer.id, clusterId);
      duplicates++;

      row.cluster_id = clusterId;
      row.normalized_url = normalized;
      row.url_hash = hash;
    } else {
      db.prepare(`UPDATE articles SET normalized_url = ?, url_hash = ? WHERE id = ?`).run(
        normalized,
        hash,
        row.id,
      );
      row.normalized_url = normalized;
      row.url_hash = hash;
    }
  }

  // 2) 제목 유사도 클러스터링 (아직 cluster_id 가 없는 것만)
  const remaining = candidates.filter((r) => !r.cluster_id);
  const groups = clusterTitles(remaining, (r) => r.title, cfg.dedupe.title_similarity_threshold);

  for (const group of groups) {
    throwIfCancelled(ctx);

    const canonical = group.reduce((a, b) => (sortKey(a) <= sortKey(b) ? a : b));
    const clusterId = createCluster(db, ctx, canonical);
    newClusters++;

    for (const member of group) {
      assignCluster(db, ctx, member.id, clusterId);
      if (member.id !== canonical.id) duplicates++;
    }
  }

  return { clusters: newClusters, duplicates };
}
