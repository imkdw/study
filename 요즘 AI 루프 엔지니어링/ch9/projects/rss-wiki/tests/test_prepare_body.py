from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import pytest

from rss_wiki.db import (
    connect,
    get_or_create_feed,
    list_pending_articles,
    record_article_failure,
    register_entries,
)
from rss_wiki.extract import ArticleFetchError
from rss_wiki.pipeline import prepare_body

NOW = "2026-09-18T00:13:02+09:00"


@dataclass
class Entry:
    key: str
    title: str | None = None
    link: str | None = None
    published_at: str | None = None
    content: str | None = None


@pytest.fixture
def conn(tmp_path: Path) -> Iterator[sqlite3.Connection]:
    connection = connect(tmp_path / "rss-wiki.db")
    try:
        yield connection
    finally:
        connection.close()


def _register_one(conn: sqlite3.Connection, entry: Entry) -> int:
    feed_id = get_or_create_feed(conn, "https://a.example.com/feed.xml", None)
    register_entries(conn, feed_id, [entry], NOW)
    articles = list_pending_articles(conn, limit=10)
    return articles[-1].id


def test_prepare_body_long_extracted_text_saved(conn: sqlite3.Connection) -> None:
    long_text = "x" * 250
    article_id = _register_one(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = list_pending_articles(conn, limit=10)[0]

    fetch_calls: list[str] = []
    extract_calls: list[tuple[str, str | None]] = []

    def tracking_fetch(url: str) -> str:
        fetch_calls.append(url)
        return "<html>unique-marker</html>"

    def tracking_extract(html: str, url: str | None) -> str:
        extract_calls.append((html, url))
        return long_text

    body = prepare_body(
        conn,
        article,
        fetch_html=tracking_fetch,
        extract=tracking_extract,
    )

    assert body == long_text
    row = conn.execute(
        "SELECT content, status, failure_count FROM articles WHERE id = ?",
        (article_id,),
    ).fetchone()
    assert row == (long_text, "pending", 0)
    assert fetch_calls == ["https://x.example.com/1"]
    assert extract_calls == [
        ("<html>unique-marker</html>", "https://x.example.com/1")
    ]


def test_prepare_body_retry_success_leaves_failed_state_unchanged(
    conn: sqlite3.Connection,
) -> None:
    article_id = _register_one(conn, Entry(key="k1", link="https://x.example.com/1"))
    record_article_failure(conn, article_id, "이전 실패")
    article = list_pending_articles(conn, limit=10)[0]

    long_text = "x" * 250
    body = prepare_body(
        conn,
        article,
        fetch_html=lambda url: "<html></html>",
        extract=lambda html, url: long_text,
    )

    assert body == long_text
    row = conn.execute(
        "SELECT content, status, failure_count, last_error FROM articles WHERE id = ?",
        (article_id,),
    ).fetchone()
    assert row[0] == long_text
    assert (row[1], row[2], row[3]) == ("failed", 1, "이전 실패")


def test_prepare_body_short_extracted_falls_back_to_feed_content(
    conn: sqlite3.Connection,
) -> None:
    article_id = _register_one(
        conn,
        Entry(key="k1", link="https://x.example.com/1", content="<p>feed &amp; x</p>"),
    )
    article = list_pending_articles(conn, limit=10)[0]

    body = prepare_body(
        conn,
        article,
        fetch_html=lambda url: "<html></html>",
        extract=lambda html, url: "short",
    )

    assert body == "feed & x"
    row = conn.execute(
        "SELECT content FROM articles WHERE id = ?", (article_id,)
    ).fetchone()
    assert row[0] == "feed & x"


def test_prepare_body_fetch_error_falls_back_to_feed_content(
    conn: sqlite3.Connection,
) -> None:
    article_id = _register_one(
        conn,
        Entry(key="k1", link="https://x.example.com/1", content="<p>feed content</p>"),
    )
    article = list_pending_articles(conn, limit=10)[0]

    def fail_fetch(url: str) -> str:
        raise ArticleFetchError("boom")

    body = prepare_body(conn, article, fetch_html=fail_fetch)

    assert body == "feed content"
    row = conn.execute(
        "SELECT content, status, failure_count FROM articles WHERE id = ?",
        (article_id,),
    ).fetchone()
    assert row == ("feed content", "pending", 0)


def test_prepare_body_no_link_skips_fetch_uses_feed_content(
    conn: sqlite3.Connection,
) -> None:
    article_id = _register_one(
        conn, Entry(key="k1", link=None, content="<p>feed content</p>")
    )
    article = list_pending_articles(conn, limit=10)[0]
    calls: list[str] = []

    def tracking_fetch(url: str) -> str:
        calls.append(url)
        return "<html></html>"

    body = prepare_body(conn, article, fetch_html=tracking_fetch)

    assert calls == []
    assert body == "feed content"
    row = conn.execute(
        "SELECT content FROM articles WHERE id = ?", (article_id,)
    ).fetchone()
    assert row[0] == "feed content"


def test_prepare_body_no_body_records_failure(conn: sqlite3.Connection) -> None:
    article_id = _register_one(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = list_pending_articles(conn, limit=10)[0]

    body = prepare_body(
        conn,
        article,
        fetch_html=lambda url: "<html></html>",
        extract=lambda html, url: None,
    )

    assert body is None
    row = conn.execute(
        "SELECT status, failure_count, last_error FROM articles WHERE id = ?",
        (article_id,),
    ).fetchone()
    assert row[0] == "failed"
    assert row[1] == 1
    assert "본문 없음" in row[2]
    assert "원문 요청 실패" not in row[2]


def test_prepare_body_no_body_twice_accumulates_failure_count(
    conn: sqlite3.Connection,
) -> None:
    article_id = _register_one(conn, Entry(key="k1", link="https://x.example.com/1"))

    for _ in range(2):
        article = list_pending_articles(conn, limit=10)[0]
        prepare_body(
            conn,
            article,
            fetch_html=lambda url: "<html></html>",
            extract=lambda html, url: None,
        )

    row = conn.execute(
        "SELECT status, failure_count FROM articles WHERE id = ?", (article_id,)
    ).fetchone()
    assert row == ("failed", 2)


def test_prepare_body_no_body_three_times_gives_up(conn: sqlite3.Connection) -> None:
    article_id = _register_one(conn, Entry(key="k1", link="https://x.example.com/1"))

    expected = [("failed", 1), ("failed", 2), ("given_up", 3)]
    for want in expected:
        article = list_pending_articles(conn, limit=10)[0]
        prepare_body(
            conn,
            article,
            fetch_html=lambda url: "<html></html>",
            extract=lambda html, url: None,
        )
        row = conn.execute(
            "SELECT status, failure_count FROM articles WHERE id = ?", (article_id,)
        ).fetchone()
        assert row == want


def test_prepare_body_given_up_excluded_from_pending_others_remain(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://a.example.com/feed.xml", None)
    register_entries(
        conn,
        feed_id,
        [
            Entry(key="k1", link="https://x.example.com/1"),
            Entry(key="k2", link="https://x.example.com/2"),
        ],
        NOW,
    )
    ids = {
        row[1]: row[0]
        for row in conn.execute("SELECT id, key FROM articles").fetchall()
    }
    given_up_id = ids["k1"]
    other_id = ids["k2"]

    for _ in range(3):
        article = next(
            a for a in list_pending_articles(conn, limit=10) if a.id == given_up_id
        )
        prepare_body(
            conn,
            article,
            fetch_html=lambda url: "<html></html>",
            extract=lambda html, url: None,
        )

    remaining_ids = {a.id for a in list_pending_articles(conn, limit=10)}
    assert given_up_id not in remaining_ids
    assert other_id in remaining_ids


def test_record_article_failure_gives_up_at_threshold_and_stays(
    conn: sqlite3.Connection,
) -> None:
    article_id = _register_one(conn, Entry(key="k1", link="https://x.example.com/1"))

    record_article_failure(conn, article_id, "err-1")
    record_article_failure(conn, article_id, "err-2")
    record_article_failure(conn, article_id, "err-3")
    row = conn.execute(
        "SELECT status, failure_count, last_error FROM articles WHERE id = ?",
        (article_id,),
    ).fetchone()
    assert row == ("given_up", 3, "err-3")

    record_article_failure(conn, article_id, "err-4")
    row = conn.execute(
        "SELECT status, failure_count FROM articles WHERE id = ?", (article_id,)
    ).fetchone()
    assert row == ("given_up", 4)


def test_prepare_body_fetch_error_no_feed_content_records_failure(
    conn: sqlite3.Connection,
) -> None:
    article_id = _register_one(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = list_pending_articles(conn, limit=10)[0]

    def fail_fetch(url: str) -> str:
        raise ArticleFetchError("boom")

    body = prepare_body(conn, article, fetch_html=fail_fetch)

    assert body is None
    row = conn.execute(
        "SELECT status, failure_count, last_error FROM articles WHERE id = ?",
        (article_id,),
    ).fetchone()
    assert row[0] == "failed"
    assert row[1] == 1
    assert "원문 요청 실패" in row[2]


def test_prepare_body_long_extracted_text_not_truncated(
    conn: sqlite3.Connection,
) -> None:
    long_text = "y" * 25_000
    article_id = _register_one(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = list_pending_articles(conn, limit=10)[0]

    prepare_body(
        conn,
        article,
        fetch_html=lambda url: "<html></html>",
        extract=lambda html, url: long_text,
    )

    row = conn.execute(
        "SELECT content FROM articles WHERE id = ?", (article_id,)
    ).fetchone()
    assert len(row[0]) == 25_000


def test_prepare_body_unexpected_exception_propagates_and_leaves_row_unchanged(
    conn: sqlite3.Connection,
) -> None:
    article_id = _register_one(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = list_pending_articles(conn, limit=10)[0]

    def raising_fetch(url: str) -> str:
        raise RuntimeError("kaboom")

    with pytest.raises(RuntimeError, match="kaboom"):
        prepare_body(conn, article, fetch_html=raising_fetch)

    row = conn.execute(
        "SELECT content, failure_count FROM articles WHERE id = ?", (article_id,)
    ).fetchone()
    assert row == (None, 0)


def test_list_pending_articles_filters_status_orders_by_id_and_limits(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://a.example.com/feed.xml", None)
    register_entries(
        conn,
        feed_id,
        [
            Entry(key="pending-1"),
            Entry(key="failed-1"),
            Entry(key="summarized-1"),
            Entry(key="given-up-1"),
        ],
        NOW,
    )
    ids = {
        row[1]: row[0]
        for row in conn.execute("SELECT id, key FROM articles").fetchall()
    }
    conn.execute(
        "UPDATE articles SET status = 'failed' WHERE id = ?", (ids["failed-1"],)
    )
    conn.execute(
        "UPDATE articles SET status = 'summarized' WHERE id = ?",
        (ids["summarized-1"],),
    )
    conn.execute(
        "UPDATE articles SET status = 'given_up' WHERE id = ?",
        (ids["given-up-1"],),
    )
    conn.commit()

    result = list_pending_articles(conn, limit=10)

    assert [a.id for a in result] == sorted(
        [ids["pending-1"], ids["failed-1"]]
    )

    limited = list_pending_articles(conn, limit=1)
    assert len(limited) == 1
    assert limited[0].id == min(ids["pending-1"], ids["failed-1"])
