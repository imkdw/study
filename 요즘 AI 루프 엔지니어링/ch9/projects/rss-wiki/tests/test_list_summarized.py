from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterator

import pytest

from rss_wiki.db import connect, list_summarized_articles

CREATED_AT = "2026-09-18T00:13:02+09:00"


@pytest.fixture
def conn(tmp_path: Path) -> Iterator[sqlite3.Connection]:
    connection = connect(tmp_path / "rss-wiki.db")
    try:
        yield connection
    finally:
        connection.close()


def _insert_feed(
    conn: sqlite3.Connection, *, url: str = "https://example.com/feed.xml", name: str | None = "Feed"
) -> int:
    cursor = conn.execute(
        "INSERT INTO feeds (url, name) VALUES (?, ?)", (url, name)
    )
    conn.commit()
    return cursor.lastrowid


def _insert_article(
    conn: sqlite3.Connection,
    feed_id: int,
    *,
    id: int | None = None,
    key: str = "article-1",
    title: str | None = "Title",
    link: str | None = "https://example.com/a",
    published_at: str | None = "2026-09-17T10:00:00+09:00",
    status: str = "summarized",
) -> int:
    if id is None:
        cursor = conn.execute(
            "INSERT INTO articles (feed_id, key, title, link, published_at, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (feed_id, key, title, link, published_at, status, CREATED_AT),
        )
    else:
        cursor = conn.execute(
            "INSERT INTO articles "
            "(id, feed_id, key, title, link, published_at, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (id, feed_id, key, title, link, published_at, status, CREATED_AT),
        )
    conn.commit()
    return cursor.lastrowid


def _insert_summary(
    conn: sqlite3.Connection,
    article_id: int,
    *,
    summary_lines: str | None = '["a", "b", "c"]',
    key_points: str | None = '["k1", "k2"]',
) -> None:
    conn.execute(
        "INSERT INTO summaries (article_id, summary_lines, key_points, created_at) "
        "VALUES (?, ?, ?, ?)",
        (article_id, summary_lines, key_points, CREATED_AT),
    )
    conn.commit()


def _insert_tag(conn: sqlite3.Connection, article_id: int, name: str) -> None:
    conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (name,))
    tag_id = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()[0]
    conn.execute(
        "INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)",
        (article_id, tag_id),
    )
    conn.commit()


def test_summarized_article_fields_match_inserted_values(conn: sqlite3.Connection) -> None:
    feed_id = _insert_feed(conn, url="https://example.com/feed.xml", name="Feed")
    article_id = _insert_article(
        conn,
        feed_id,
        title="Hello",
        link="https://example.com/a",
        published_at="2026-09-17T10:00:00+09:00",
    )
    _insert_summary(conn, article_id)

    [result] = list_summarized_articles(conn)
    assert result.id == article_id
    assert result.feed_id == feed_id
    assert result.feed_name == "Feed"
    assert result.feed_url == "https://example.com/feed.xml"
    assert result.title == "Hello"
    assert result.link == "https://example.com/a"
    assert result.published_at == "2026-09-17T10:00:00+09:00"
    assert result.created_at == CREATED_AT
    assert result.summary_lines == ["a", "b", "c"]
    assert result.key_points == ["k1", "k2"]


@pytest.mark.parametrize("status", ["pending", "failed", "given_up"])
def test_non_summarized_articles_are_excluded(conn: sqlite3.Connection, status: str) -> None:
    feed_id = _insert_feed(conn)
    article_id = _insert_article(conn, feed_id, status=status)
    if status != "pending":
        conn.execute(
            "UPDATE articles SET failure_count = 1 WHERE id = ?", (article_id,)
        )
        conn.commit()
    # 상태가 바뀐 뒤에도 이전 summaries 행이 남아 있을 수 있으므로 JOIN만으로
    # 걸러지지 않는지(= WHERE status 절이 실제로 쓰이는지) 함께 확인한다.
    _insert_summary(conn, article_id)

    assert list_summarized_articles(conn) == []


def test_tags_are_sorted_by_name_and_untagged_article_has_empty_list(
    conn: sqlite3.Connection,
) -> None:
    feed_id = _insert_feed(conn)
    tagged_id = _insert_article(conn, feed_id, key="tagged")
    _insert_summary(conn, tagged_id)
    _insert_tag(conn, tagged_id, "rust")
    _insert_tag(conn, tagged_id, "ai")
    _insert_tag(conn, tagged_id, "python")

    untagged_id = _insert_article(conn, feed_id, key="untagged")
    _insert_summary(conn, untagged_id)

    results = {r.id: r for r in list_summarized_articles(conn)}
    assert results[tagged_id].tags == ["ai", "python", "rust"]
    assert results[untagged_id].tags == []


def test_results_ordered_by_id_ascending_regardless_of_insert_order(
    conn: sqlite3.Connection,
) -> None:
    feed_id = _insert_feed(conn)
    _insert_article(conn, feed_id, id=3, key="k3")
    _insert_article(conn, feed_id, id=1, key="k1")
    _insert_article(conn, feed_id, id=2, key="k2")
    for article_id in (3, 1, 2):
        _insert_summary(conn, article_id)

    results = list_summarized_articles(conn)
    assert [r.id for r in results] == [1, 2, 3]


def test_null_summary_lines_and_key_points_become_empty_lists(
    conn: sqlite3.Connection,
) -> None:
    feed_id = _insert_feed(conn)
    article_id = _insert_article(conn, feed_id)
    _insert_summary(conn, article_id, summary_lines=None, key_points=None)

    [result] = list_summarized_articles(conn)
    assert result.summary_lines == []
    assert result.key_points == []


def test_each_article_keeps_its_own_feed_name_and_url(conn: sqlite3.Connection) -> None:
    feed_a = _insert_feed(conn, url="https://a.example.com/feed.xml", name="Feed A")
    feed_b = _insert_feed(conn, url="https://b.example.com/feed.xml", name=None)

    article_a = _insert_article(conn, feed_a, key="a-1")
    _insert_summary(conn, article_a)
    article_b = _insert_article(conn, feed_b, key="b-1")
    _insert_summary(conn, article_b)

    results = {r.id: r for r in list_summarized_articles(conn)}
    assert results[article_a].feed_name == "Feed A"
    assert results[article_a].feed_url == "https://a.example.com/feed.xml"
    assert results[article_b].feed_name is None
    assert results[article_b].feed_url == "https://b.example.com/feed.xml"
