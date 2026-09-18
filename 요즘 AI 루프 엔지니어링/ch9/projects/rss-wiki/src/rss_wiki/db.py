from __future__ import annotations

import json
import sqlite3
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Protocol

SCHEMA = """
CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    name TEXT,
    last_fetched_at TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id INTEGER NOT NULL REFERENCES feeds (id),
    key TEXT NOT NULL,
    title TEXT,
    link TEXT,
    published_at TEXT,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'summarized', 'failed', 'given_up')),
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (feed_id, key)
);

CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL UNIQUE REFERENCES articles (id),
    summary_lines TEXT,
    key_points TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS article_tags (
    article_id INTEGER NOT NULL REFERENCES articles (id),
    tag_id INTEGER NOT NULL REFERENCES tags (id),
    PRIMARY KEY (article_id, tag_id)
);

CREATE TABLE IF NOT EXISTS skipped_keys (
    feed_id INTEGER NOT NULL REFERENCES feeds (id),
    key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (feed_id, key)
);
"""


SCHEMA_VERSION = 2

FIRST_RUN_LIMIT = 10

GIVE_UP_THRESHOLD = 3


class SchemaVersionError(Exception):
    pass


class EntryLike(Protocol):
    key: str
    title: str | None
    link: str | None
    published_at: str | None  # 로컬 오프셋 포함 ISO8601 문자열 또는 None
    content: str | None


@dataclass(frozen=True)
class PendingArticle:
    id: int
    link: str | None
    content: str | None


def connect(path: str | Path) -> sqlite3.Connection:
    db_path = Path(path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")

    user_version = conn.execute("PRAGMA user_version").fetchone()[0]
    if user_version > SCHEMA_VERSION:
        conn.close()
        raise SchemaVersionError(
            f"DB 스키마 버전 {user_version}이 코드 버전 {SCHEMA_VERSION}보다 "
            f"높습니다: {db_path}"
        )

    conn.executescript(SCHEMA)
    conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
    conn.commit()
    return conn


def get_or_create_feed(conn: sqlite3.Connection, url: str, name: str | None) -> int:
    row = conn.execute("SELECT id, name FROM feeds WHERE url = ?", (url,)).fetchone()
    if row is None:
        cursor = conn.execute(
            "INSERT INTO feeds (url, name) VALUES (?, ?)", (url, name)
        )
        conn.commit()
        return cursor.lastrowid

    feed_id, existing_name = row
    if name is not None and existing_name != name:
        conn.execute("UPDATE feeds SET name = ? WHERE id = ?", (name, feed_id))
        conn.commit()
    return feed_id


def _parse_published_at(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed


def record_feed_success(conn: sqlite3.Connection, feed_id: int, now: str) -> None:
    conn.execute(
        "UPDATE feeds SET last_fetched_at = ?, consecutive_failures = 0, "
        "last_error = NULL WHERE id = ?",
        (now, feed_id),
    )
    conn.commit()


def record_feed_failure(conn: sqlite3.Connection, feed_id: int, error: str) -> None:
    conn.execute(
        "UPDATE feeds SET consecutive_failures = consecutive_failures + 1, "
        "last_error = ? WHERE id = ?",
        (error, feed_id),
    )
    conn.commit()


def get_feed_failures(conn: sqlite3.Connection, url: str) -> int | None:
    """피드의 연속 실패 횟수를 조회한다. 조회 전용이며 없는 피드는 등록하지 않고 `None`을 돌려준다."""
    row = conn.execute(
        "SELECT consecutive_failures FROM feeds WHERE url = ?", (url,)
    ).fetchone()
    return None if row is None else row[0]


def register_entries(
    conn: sqlite3.Connection,
    feed_id: int,
    entries: Sequence[EntryLike],
    now: str,
) -> int:
    """새 글을 등록한다.

    예외 시 연결 전체를 rollback 하므로 호출 전에 커밋되지 않은 작업을
    두지 않는다.
    """
    seen_keys: set[str] = set()
    deduped: list[EntryLike] = []
    for entry in entries:
        if entry.key in seen_keys:
            continue
        seen_keys.add(entry.key)
        deduped.append(entry)

    try:
        existing_keys = {
            row[0]
            for row in conn.execute(
                "SELECT key FROM articles WHERE feed_id = ?", (feed_id,)
            ).fetchall()
        }
        existing_keys |= {
            row[0]
            for row in conn.execute(
                "SELECT key FROM skipped_keys WHERE feed_id = ?", (feed_id,)
            ).fetchall()
        }
        new_entries = [entry for entry in deduped if entry.key not in existing_keys]

        article_count = conn.execute(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?", (feed_id,)
        ).fetchone()[0]
        skipped_count = conn.execute(
            "SELECT COUNT(*) FROM skipped_keys WHERE feed_id = ?", (feed_id,)
        ).fetchone()[0]
        is_first_run = article_count == 0 and skipped_count == 0

        if is_first_run:
            dated: list[tuple[datetime, EntryLike]] = []
            undated: list[EntryLike] = []
            for entry in new_entries:
                parsed = _parse_published_at(entry.published_at)
                if parsed is None:
                    undated.append(entry)
                else:
                    dated.append((parsed, entry))
            dated.sort(key=lambda pair: pair[0], reverse=True)
            ordered = [entry for _, entry in dated] + undated
            to_insert = ordered[:FIRST_RUN_LIMIT]
            to_skip = ordered[FIRST_RUN_LIMIT:]
        else:
            to_insert = new_entries
            to_skip = []

        for entry in to_insert:
            conn.execute(
                "INSERT INTO articles "
                "(feed_id, key, title, link, published_at, content, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    feed_id,
                    entry.key,
                    entry.title,
                    entry.link,
                    entry.published_at,
                    entry.content,
                    now,
                ),
            )
        for entry in to_skip:
            conn.execute(
                "INSERT INTO skipped_keys (feed_id, key, created_at) VALUES (?, ?, ?)",
                (feed_id, entry.key, now),
            )

        conn.commit()
    except BaseException:
        conn.rollback()
        raise

    return len(to_insert)


def list_pending_articles(conn: sqlite3.Connection, limit: int) -> list[PendingArticle]:
    """본문 준비 대상(`pending`/`failed`) 글을 `id` 오름차순으로 최대 `limit`개 돌려준다."""
    rows = conn.execute(
        "SELECT id, link, content FROM articles "
        "WHERE status IN ('pending', 'failed') ORDER BY id ASC LIMIT ?",
        (limit,),
    ).fetchall()
    return [PendingArticle(id=row[0], link=row[1], content=row[2]) for row in rows]


def save_article_body(conn: sqlite3.Connection, article_id: int, body: str) -> None:
    """본문을 저장한다. `status`/`failure_count`/`last_error`는 바꾸지 않는다(요약 성공 전)."""
    conn.execute(
        "UPDATE articles SET content = ? WHERE id = ?", (body, article_id)
    )
    conn.commit()


def record_article_failure(conn: sqlite3.Connection, article_id: int, error: str) -> None:
    """실패를 기록한다.

    3회째 실패에서 `given_up`이 되고 `list_pending_articles`가 더 꺼내지
    않는다(PRD 7절).
    """
    conn.execute(
        "UPDATE articles SET "
        "status = CASE WHEN failure_count + 1 >= ? THEN 'given_up' ELSE 'failed' END, "
        "failure_count = failure_count + 1, "
        "last_error = ? WHERE id = ?",
        (GIVE_UP_THRESHOLD, error, article_id),
    )
    conn.commit()


def count_given_up_articles(conn: sqlite3.Connection) -> int:
    """포기한(`given_up`) 글 수를 센다. 조회 전용이며 행을 만들거나 고치지 않는다."""
    return conn.execute(
        "SELECT COUNT(*) FROM articles WHERE status = 'given_up'"
    ).fetchone()[0]


@dataclass(frozen=True)
class SummarizedArticle:
    id: int
    feed_id: int
    feed_name: str | None
    feed_url: str
    title: str | None
    link: str | None
    published_at: str | None
    created_at: str
    summary_lines: list[str]
    key_points: list[str]
    tags: list[str]


def list_summarized_articles(conn: sqlite3.Connection) -> list[SummarizedArticle]:
    """요약이 끝난(`status = 'summarized'`) 글을 `id` 오름차순으로 돌려준다.

    태그는 글마다 따로 묻지 않고 한 번 더 조회해 글 id별로 모은다.
    """
    rows = conn.execute(
        "SELECT a.id, a.feed_id, f.name, f.url, a.title, a.link, a.published_at, "
        "a.created_at, s.summary_lines, s.key_points "
        "FROM articles a "
        "JOIN summaries s ON s.article_id = a.id "
        "JOIN feeds f ON f.id = a.feed_id "
        "WHERE a.status = 'summarized' "
        "ORDER BY a.id ASC"
    ).fetchall()

    tags_by_article: dict[int, list[str]] = {}
    for article_id, tag_name in conn.execute(
        "SELECT at.article_id, t.name FROM article_tags at "
        "JOIN tags t ON t.id = at.tag_id "
        "ORDER BY t.name ASC"
    ).fetchall():
        tags_by_article.setdefault(article_id, []).append(tag_name)

    return [
        SummarizedArticle(
            id=row[0],
            feed_id=row[1],
            feed_name=row[2],
            feed_url=row[3],
            title=row[4],
            link=row[5],
            published_at=row[6],
            created_at=row[7],
            summary_lines=json.loads(row[8]) if row[8] is not None else [],
            key_points=json.loads(row[9]) if row[9] is not None else [],
            tags=tags_by_article.get(row[0], []),
        )
        for row in rows
    ]


def list_tag_names(conn: sqlite3.Connection) -> list[str]:
    """모든 태그 이름을 이름 오름차순으로 돌려준다(프롬프트가 실행마다 같도록)."""
    rows = conn.execute("SELECT name FROM tags ORDER BY name ASC").fetchall()
    return [row[0] for row in rows]


def save_summary(
    conn: sqlite3.Connection,
    article_id: int,
    summary_lines: Sequence[str],
    key_points: Sequence[str],
    tags: Sequence[str],
    now: str,
) -> None:
    """요약 결과를 저장한다. 태그는 이미 정규화된 값으로 가정한다.

    태그 등록 → `summaries` 삽입 → `articles` 상태 갱신 순서로 한 트랜잭션에서
    실행하고 끝에서 커밋 한 번. 예외 시 rollback 후 다시 올린다
    (`register_entries`와 같은 방식).
    """
    try:
        for tag in tags:
            conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (tag,))
            tag_id = conn.execute(
                "SELECT id FROM tags WHERE name = ?", (tag,)
            ).fetchone()[0]
            conn.execute(
                "INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)",
                (article_id, tag_id),
            )

        conn.execute(
            "INSERT INTO summaries (article_id, summary_lines, key_points, created_at) "
            "VALUES (?, ?, ?, ?)",
            (
                article_id,
                json.dumps(list(summary_lines), ensure_ascii=False),
                json.dumps(list(key_points), ensure_ascii=False),
                now,
            ),
        )

        conn.execute(
            "UPDATE articles SET status = 'summarized', last_error = NULL, "
            "failure_count = 0 WHERE id = ?",
            (article_id,),
        )

        conn.commit()
    except BaseException:
        conn.rollback()
        raise
