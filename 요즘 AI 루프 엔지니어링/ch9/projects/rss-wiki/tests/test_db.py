import sqlite3
from pathlib import Path
from typing import Iterator

import pytest

from rss_wiki.db import (
    SCHEMA_VERSION,
    SchemaVersionError,
    connect,
    count_given_up_articles,
    get_feed_failures,
)

CREATED_AT = "2026-09-18T00:13:02+09:00"

V1_SCHEMA = """
CREATE TABLE feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    name TEXT,
    last_fetched_at TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE TABLE articles (
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

CREATE TABLE summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL UNIQUE REFERENCES articles (id),
    summary_lines TEXT,
    key_points TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE article_tags (
    article_id INTEGER NOT NULL REFERENCES articles (id),
    tag_id INTEGER NOT NULL REFERENCES tags (id),
    PRIMARY KEY (article_id, tag_id)
);
"""


@pytest.fixture
def conn(tmp_path: Path) -> Iterator[sqlite3.Connection]:
    connection = connect(tmp_path / "rss-wiki.db")
    try:
        yield connection
    finally:
        connection.close()


def test_connect_creates_db_file_in_missing_subdirectory(tmp_path: Path) -> None:
    db_path = tmp_path / "nested" / "dir" / "rss-wiki.db"

    connection = connect(db_path)
    connection.close()

    assert db_path.is_file()


def test_connect_creates_expected_tables(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).fetchall()
    table_names = {row[0] for row in rows}

    assert {
        "feeds",
        "articles",
        "summaries",
        "tags",
        "article_tags",
        "skipped_keys",
    } <= table_names


def test_connect_sets_user_version(conn: sqlite3.Connection) -> None:
    user_version = conn.execute("PRAGMA user_version").fetchone()[0]

    assert user_version == SCHEMA_VERSION


def test_duplicate_feed_id_and_key_raises_integrity_error(
    conn: sqlite3.Connection,
) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    conn.execute(
        "INSERT INTO articles (feed_id, key, created_at) VALUES (?, 'article-1', ?)",
        (feed_id, CREATED_AT),
    )
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="UNIQUE"):
        conn.execute(
            "INSERT INTO articles (feed_id, key, created_at) VALUES (?, 'article-1', ?)",
            (feed_id, CREATED_AT),
        )


def test_invalid_status_raises_integrity_error(conn: sqlite3.Connection) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="CHECK"):
        conn.execute(
            "INSERT INTO articles (feed_id, key, status, created_at) "
            "VALUES (?, 'article-1', 'bogus', ?)",
            (feed_id, CREATED_AT),
        )


def test_article_without_created_at_raises_integrity_error(
    conn: sqlite3.Connection,
) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="NOT NULL"):
        conn.execute(
            "INSERT INTO articles (feed_id, key) VALUES (?, 'article-1')",
            (feed_id,),
        )


def test_article_with_unknown_feed_id_raises_integrity_error(
    conn: sqlite3.Connection,
) -> None:
    with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
        conn.execute(
            "INSERT INTO articles (feed_id, key, created_at) VALUES (999, 'article-1', ?)",
            (CREATED_AT,),
        )


def test_connect_twice_on_same_path_keeps_data_and_pragma(tmp_path: Path) -> None:
    db_path = tmp_path / "rss-wiki.db"

    conn1 = connect(db_path)
    conn1.execute("INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')")
    conn1.commit()
    conn1.close()

    conn2 = connect(db_path)
    try:
        rows = conn2.execute("SELECT url FROM feeds").fetchall()
        assert rows == [("https://example.com/feed.xml",)]

        foreign_keys = conn2.execute("PRAGMA foreign_keys").fetchone()[0]
        assert foreign_keys == 1
    finally:
        conn2.close()


def test_article_insert_uses_default_status_and_failure_count(
    conn: sqlite3.Connection,
) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    conn.execute(
        "INSERT INTO articles (feed_id, key, created_at) VALUES (?, 'article-1', ?)",
        (feed_id, CREATED_AT),
    )
    conn.commit()

    row = conn.execute(
        "SELECT status, failure_count FROM articles WHERE key = 'article-1'"
    ).fetchone()

    assert row[0] == "pending"
    assert row[1] == 0


def test_duplicate_feed_url_raises_integrity_error(conn: sqlite3.Connection) -> None:
    conn.execute("INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')")
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="UNIQUE"):
        conn.execute("INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')")


def test_duplicate_summary_article_id_raises_integrity_error(
    conn: sqlite3.Connection,
) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    cursor = conn.execute(
        "INSERT INTO articles (feed_id, key, created_at) VALUES (?, 'article-1', ?)",
        (feed_id, CREATED_AT),
    )
    article_id = cursor.lastrowid
    conn.execute(
        "INSERT INTO summaries (article_id, created_at) VALUES (?, ?)",
        (article_id, CREATED_AT),
    )
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="UNIQUE"):
        conn.execute(
            "INSERT INTO summaries (article_id, created_at) VALUES (?, ?)",
            (article_id, CREATED_AT),
        )


def test_summary_with_unknown_article_id_raises_integrity_error(
    conn: sqlite3.Connection,
) -> None:
    with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
        conn.execute(
            "INSERT INTO summaries (article_id, created_at) VALUES (999, ?)",
            (CREATED_AT,),
        )


def test_summary_without_created_at_raises_not_null_integrity_error(
    conn: sqlite3.Connection,
) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    cursor = conn.execute(
        "INSERT INTO articles (feed_id, key, created_at) VALUES (?, 'article-1', ?)",
        (feed_id, CREATED_AT),
    )
    article_id = cursor.lastrowid
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="NOT NULL"):
        conn.execute(
            "INSERT INTO summaries (article_id) VALUES (?)",
            (article_id,),
        )


def test_article_tag_with_unknown_tag_id_raises_integrity_error(
    conn: sqlite3.Connection,
) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    cursor = conn.execute(
        "INSERT INTO articles (feed_id, key, created_at) VALUES (?, 'article-1', ?)",
        (feed_id, CREATED_AT),
    )
    article_id = cursor.lastrowid
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
        conn.execute(
            "INSERT INTO article_tags (article_id, tag_id) VALUES (?, 999)",
            (article_id,),
        )


def test_article_tag_with_unknown_article_id_raises_integrity_error(
    conn: sqlite3.Connection,
) -> None:
    tag_cursor = conn.execute("INSERT INTO tags (name) VALUES ('python')")
    tag_id = tag_cursor.lastrowid
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
        conn.execute(
            "INSERT INTO article_tags (article_id, tag_id) VALUES (999, ?)",
            (tag_id,),
        )


def test_duplicate_article_tag_pair_raises_integrity_error(
    conn: sqlite3.Connection,
) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    cursor = conn.execute(
        "INSERT INTO articles (feed_id, key, created_at) VALUES (?, 'article-1', ?)",
        (feed_id, CREATED_AT),
    )
    article_id = cursor.lastrowid
    tag_cursor = conn.execute("INSERT INTO tags (name) VALUES ('python')")
    tag_id = tag_cursor.lastrowid
    conn.execute(
        "INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)",
        (article_id, tag_id),
    )
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="UNIQUE"):
        conn.execute(
            "INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)",
            (article_id, tag_id),
        )


def test_connect_raises_when_user_version_exceeds_schema_version(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "rss-wiki.db"

    conn1 = connect(db_path)
    conn1.execute(f"PRAGMA user_version = {SCHEMA_VERSION + 1}")
    conn1.close()

    with pytest.raises(SchemaVersionError, match="스키마 버전"):
        connect(db_path)

    raw_conn = sqlite3.connect(db_path)
    try:
        user_version = raw_conn.execute("PRAGMA user_version").fetchone()[0]
        assert user_version == SCHEMA_VERSION + 1
    finally:
        raw_conn.close()


def test_connect_rejects_new_file_with_higher_user_version_without_creating_tables(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "rss-wiki.db"
    raw_conn = sqlite3.connect(db_path)
    raw_conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION + 1}")
    raw_conn.commit()
    raw_conn.close()

    with pytest.raises(SchemaVersionError, match="스키마 버전"):
        connect(db_path)

    raw_conn = sqlite3.connect(db_path)
    try:
        tables = {
            row[0]
            for row in raw_conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        assert "feeds" not in tables
    finally:
        raw_conn.close()


def test_connect_adds_skipped_keys_table_to_v1_db(tmp_path: Path) -> None:
    db_path = tmp_path / "rss-wiki.db"
    raw_conn = sqlite3.connect(db_path)
    raw_conn.executescript(V1_SCHEMA)
    raw_conn.execute("PRAGMA user_version = 1")
    raw_conn.commit()
    raw_conn.close()

    connection = connect(db_path)
    try:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        assert "skipped_keys" in tables

        user_version = connection.execute("PRAGMA user_version").fetchone()[0]
        assert user_version == SCHEMA_VERSION
    finally:
        connection.close()


def test_duplicate_skipped_key_raises_integrity_error(
    conn: sqlite3.Connection,
) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    conn.execute(
        "INSERT INTO skipped_keys (feed_id, key, created_at) VALUES (?, 'a-1', ?)",
        (feed_id, CREATED_AT),
    )
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="UNIQUE"):
        conn.execute(
            "INSERT INTO skipped_keys (feed_id, key, created_at) VALUES (?, 'a-1', ?)",
            (feed_id, CREATED_AT),
        )


def test_get_feed_failures_unregistered_url_returns_none(
    conn: sqlite3.Connection,
) -> None:
    assert get_feed_failures(conn, "https://unknown.example.com/feed.xml") is None
    assert conn.execute("SELECT COUNT(*) FROM feeds").fetchone()[0] == 0


def test_get_feed_failures_returns_consecutive_failures(
    conn: sqlite3.Connection,
) -> None:
    conn.execute(
        "INSERT INTO feeds (url, consecutive_failures) VALUES (?, 2)",
        ("https://example.com/feed.xml",),
    )
    conn.commit()

    assert get_feed_failures(conn, "https://example.com/feed.xml") == 2


def test_count_given_up_articles_counts_only_given_up_status(
    conn: sqlite3.Connection,
) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    for i, status in enumerate(("pending", "summarized", "failed", "given_up")):
        conn.execute(
            "INSERT INTO articles (feed_id, key, status, created_at) "
            "VALUES (?, ?, ?, ?)",
            (feed_id, f"k{i}", status, CREATED_AT),
        )
    conn.commit()

    assert count_given_up_articles(conn) == 1


def test_count_given_up_articles_is_read_only_and_zero_without_given_up(
    conn: sqlite3.Connection,
) -> None:
    feed_cursor = conn.execute(
        "INSERT INTO feeds (url) VALUES ('https://example.com/feed.xml')"
    )
    feed_id = feed_cursor.lastrowid
    conn.execute(
        "INSERT INTO articles (feed_id, key, status, created_at) "
        "VALUES (?, 'k1', 'pending', ?)",
        (feed_id, CREATED_AT),
    )
    conn.commit()

    assert count_given_up_articles(conn) == 0
    assert conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0] == 1
