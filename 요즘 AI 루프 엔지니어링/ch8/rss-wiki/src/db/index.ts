import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export type Db = DatabaseSync;

/** DB를 열고 스키마를 적용한다. 여러 번 호출해도 안전하다. */
export function openDb(path = '.rss-wiki/rss-wiki.db'): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  const sql = readFileSync(join(here, 'schema.sql'), 'utf8');
  db.exec(sql);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** node:sqlite 는 boolean 을 바인딩하지 못한다. */
export function bool(v: boolean | undefined | null): number {
  return v ? 1 : 0;
}

/** 동기 트랜잭션. 예외가 나면 롤백한다. */
export function tx<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* 이미 롤백됨 */
    }
    throw e;
  }
}
