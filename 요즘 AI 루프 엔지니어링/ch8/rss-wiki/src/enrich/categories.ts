/** 카테고리 정책: 시드 upsert, 신규 카테고리 pending 누적/승격, low confidence 가드. */
import { nowIso } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import type { AppConfig, EnrichResult } from '../types.ts';

interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  is_seed: number;
  status: string;
  pending_count: number;
  created_at: string;
}

/** 소문자, 공백/언더스코어 -> '-', 한글/영숫자/'-' 만 남긴다. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\-가-힣]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getBySlug(db: Db, slug: string): CategoryRow | undefined {
  return db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as CategoryRow | undefined;
}

function getOrCreateMisc(db: Db): CategoryRow {
  const existing = getBySlug(db, 'misc');
  if (existing) return existing;
  db.prepare(
    `INSERT INTO categories (slug, name, is_seed, status, pending_count, created_at)
     VALUES ('misc', 'misc', 1, 'active', 0, ?)`,
  ).run(nowIso());
  return getBySlug(db, 'misc')!;
}

/** 시드 카테고리를 is_seed=1, status='active' 로 upsert 한다. */
export function ensureSeedCategories(db: Db, seeds: string[]): void {
  const now = nowIso();
  const stmt = db.prepare(
    `INSERT INTO categories (slug, name, is_seed, status, pending_count, created_at)
     VALUES (?, ?, 1, 'active', 0, ?)
     ON CONFLICT(slug) DO UPDATE SET is_seed = 1, status = 'active'`,
  );
  for (const seed of seeds) {
    const slug = slugify(seed);
    if (!slug) continue;
    stmt.run(slug, seed, now);
  }
}

/**
 * EnrichResult 를 실제 카테고리로 배정한다.
 * - confidence 가 낮으면 misc + needsReview.
 * - 이미 active 인 카테고리면 그대로 사용.
 * - 그 외(신규 제안 등)는 pending_count 를 누적하고, promote_after 에 도달하면 승격한다.
 *   승격 전까지는 misc 에 배정한다.
 */
export function resolveCategory(
  db: Db,
  r: EnrichResult,
  cfg: AppConfig,
): { categoryId: number; slug: string; needsReview: boolean } {
  if (r.confidence < cfg.categories.low_confidence_threshold) {
    const misc = getOrCreateMisc(db);
    return { categoryId: misc.id, slug: 'misc', needsReview: true };
  }

  const slug = slugify(r.category);
  if (!slug || slug === 'misc') {
    const misc = getOrCreateMisc(db);
    return { categoryId: misc.id, slug: 'misc', needsReview: false };
  }

  const existing = getBySlug(db, slug);
  if (existing && existing.status === 'active') {
    return { categoryId: existing.id, slug, needsReview: false };
  }

  const pendingCount = (existing?.pending_count ?? 0) + 1;
  if (existing) {
    db.prepare('UPDATE categories SET pending_count = ? WHERE id = ?').run(pendingCount, existing.id);
  } else {
    db.prepare(
      `INSERT INTO categories (slug, name, is_seed, status, pending_count, created_at)
       VALUES (?, ?, 0, 'pending', ?, ?)`,
    ).run(slug, r.category, pendingCount, nowIso());
  }

  if (pendingCount >= cfg.categories.promote_after) {
    db.prepare("UPDATE categories SET status = 'active' WHERE slug = ?").run(slug);
    const promoted = getBySlug(db, slug)!;
    return { categoryId: promoted.id, slug, needsReview: false };
  }

  const misc = getOrCreateMisc(db);
  return { categoryId: misc.id, slug: 'misc', needsReview: false };
}

/** doctor 용: 아직 승격되지 않은 신규 카테고리 후보 목록 */
export function pendingCategories(db: Db): Array<{ slug: string; pending_count: number }> {
  return db
    .prepare("SELECT slug, pending_count FROM categories WHERE status = 'pending' ORDER BY slug")
    .all() as Array<{ slug: string; pending_count: number }>;
}

/** 현재 active 상태인 카테고리 목록 */
export function activeCategories(db: Db): { id: number; slug: string; name: string }[] {
  return db
    .prepare("SELECT id, slug, name FROM categories WHERE status = 'active' ORDER BY slug")
    .all() as { id: number; slug: string; name: string }[];
}
