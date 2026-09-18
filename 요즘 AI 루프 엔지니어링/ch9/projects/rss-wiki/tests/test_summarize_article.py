from __future__ import annotations

import json
import sqlite3
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import pytest

from rss_wiki.db import (
    PendingArticle,
    connect,
    get_or_create_feed,
    list_pending_articles,
    list_tag_names,
    register_entries,
    save_summary,
)
from rss_wiki.extract import ArticleFetchError
from rss_wiki.pipeline import summarize_article
from rss_wiki.summarize import ClaudeUnavailableError, SummaryCallError, SummaryFormatError, SummaryResult

NOW = "2026-09-18T00:13:02+09:00"
FEED_URL = "https://a.example.com/feed.xml"


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


def _register(conn: sqlite3.Connection, entry: Entry) -> None:
    feed_id = get_or_create_feed(conn, FEED_URL, None)
    register_entries(conn, feed_id, [entry], NOW)


def _only_pending(conn: sqlite3.Connection) -> PendingArticle:
    articles = list_pending_articles(conn, limit=10)
    assert len(articles) == 1
    return articles[0]


def _fetch_html(url: str) -> str:
    return "<html>marker</html>"


def _extract(text: str | None) -> Callable[[str, str | None], str | None]:
    return lambda html, url: text


def _fake_summarize(
    result: SummaryResult | BaseException, calls: list[tuple[str, list[str]]]
) -> Callable[[str, Sequence[str]], SummaryResult]:
    def fn(body: str, tags: Sequence[str]) -> SummaryResult:
        calls.append((body, list(tags)))
        if isinstance(result, BaseException):
            raise result
        return result

    return fn


def _row(conn: sqlite3.Connection, article_id: int, fields: list[str]) -> tuple:
    cols = ", ".join(fields)
    return conn.execute(
        f"SELECT {cols} FROM articles WHERE id = ?", (article_id,)
    ).fetchone()


def test_summarize_article_success_saves_summary_and_updates_status(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = _only_pending(conn)
    result = SummaryResult(
        summary=["첫 줄", "둘째 줄", "셋째 줄"], key_points=["포인트"], tags=["python", "ai"]
    )

    ok = summarize_article(
        conn,
        article,
        fetch_html=_fetch_html,
        extract=_extract("x" * 250),
        summarize=_fake_summarize(result, []),
        now=lambda: NOW,
    )

    assert ok is True
    summary_lines, key_points, created_at = conn.execute(
        "SELECT summary_lines, key_points, created_at FROM summaries WHERE article_id = ?",
        (article.id,),
    ).fetchone()
    assert json.loads(summary_lines) == ["첫 줄", "둘째 줄", "셋째 줄"]
    assert json.loads(key_points) == ["포인트"]
    assert created_at == NOW
    status, last_error = _row(conn, article.id, ["status", "last_error"])
    assert (status, last_error) == ("summarized", None)
    tag_names = {
        row[0]
        for row in conn.execute(
            "SELECT t.name FROM tags t "
            "JOIN article_tags at ON at.tag_id = t.id "
            "WHERE at.article_id = ?",
            (article.id,),
        ).fetchall()
    }
    assert tag_names == {"python", "ai"}


def test_summarize_article_success_stores_korean_text_unescaped(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = _only_pending(conn)
    result = SummaryResult(
        summary=["첫 줄", "둘째 줄", "셋째 줄"], key_points=["포인트"], tags=[]
    )

    summarize_article(
        conn,
        article,
        fetch_html=_fetch_html,
        extract=_extract("x" * 250),
        summarize=_fake_summarize(result, []),
        now=lambda: NOW,
    )

    raw = conn.execute(
        "SELECT summary_lines FROM summaries WHERE article_id = ?", (article.id,)
    ).fetchone()[0]
    assert "첫 줄" in raw
    assert "\\u" not in raw


def test_summarize_article_passes_existing_tags_sorted_and_body_of_current_article(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1"))
    article1 = _only_pending(conn)
    result1 = SummaryResult(summary=["a", "b", "c"], key_points=["p"], tags=["rust", "ai"])
    summarize_article(
        conn,
        article1,
        fetch_html=_fetch_html,
        extract=_extract("x" * 250),
        summarize=_fake_summarize(result1, []),
        now=lambda: NOW,
    )

    _register(conn, Entry(key="k2", link="https://x.example.com/2"))
    article2 = _only_pending(conn)
    calls: list[tuple[str, list[str]]] = []
    body2 = "y" * 250
    result2 = SummaryResult(summary=["d", "e", "f"], key_points=["p2"], tags=[])

    summarize_article(
        conn,
        article2,
        fetch_html=_fetch_html,
        extract=_extract(body2),
        summarize=_fake_summarize(result2, calls),
        now=lambda: NOW,
    )

    assert calls[0][1] == ["ai", "rust"]
    assert calls[0][0] == body2


def test_summarize_article_shares_tags_across_articles(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1"))
    article1 = _only_pending(conn)
    summarize_article(
        conn,
        article1,
        fetch_html=_fetch_html,
        extract=_extract("x" * 250),
        summarize=_fake_summarize(
            SummaryResult(summary=["a", "b", "c"], key_points=["p"], tags=["ai"]), []
        ),
        now=lambda: NOW,
    )

    _register(conn, Entry(key="k2", link="https://x.example.com/2"))
    article2 = _only_pending(conn)
    summarize_article(
        conn,
        article2,
        fetch_html=_fetch_html,
        extract=_extract("y" * 250),
        summarize=_fake_summarize(
            SummaryResult(summary=["d", "e", "f"], key_points=["p2"], tags=["ai", "ml"]), []
        ),
        now=lambda: NOW,
    )

    assert conn.execute("SELECT COUNT(*) FROM tags").fetchone()[0] == 2
    assert conn.execute("SELECT COUNT(*) FROM article_tags").fetchone()[0] == 3


def test_summarize_article_zero_tags_saves_summary_with_no_article_tags(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = _only_pending(conn)

    ok = summarize_article(
        conn,
        article,
        fetch_html=_fetch_html,
        extract=_extract("x" * 250),
        summarize=_fake_summarize(
            SummaryResult(summary=["a", "b", "c"], key_points=["p"], tags=[]), []
        ),
        now=lambda: NOW,
    )

    assert ok is True
    assert conn.execute("SELECT COUNT(*) FROM summaries").fetchone()[0] == 1
    article_tags_count = conn.execute(
        "SELECT COUNT(*) FROM article_tags WHERE article_id = ?", (article.id,)
    ).fetchone()[0]
    assert article_tags_count == 0
    assert _row(conn, article.id, ["status"])[0] == "summarized"


def test_summarize_article_format_error_records_failure(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = _only_pending(conn)
    extracted = "x" * 250
    error = SummaryFormatError("tags 필드가 문자열 목록이 아니다")

    ok = summarize_article(
        conn,
        article,
        fetch_html=_fetch_html,
        extract=_extract(extracted),
        summarize=_fake_summarize(error, []),
        now=lambda: NOW,
    )

    assert ok is False
    status, failure_count, last_error, content = _row(
        conn, article.id, ["status", "failure_count", "last_error", "content"]
    )
    assert (status, failure_count) == ("failed", 1)
    assert "tags 필드" in last_error
    assert conn.execute("SELECT COUNT(*) FROM summaries").fetchone()[0] == 0
    assert content == extracted


def test_summarize_article_call_error_records_failure(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = _only_pending(conn)
    extracted = "x" * 250
    error = SummaryCallError("claude 종료 코드 1: x")

    ok = summarize_article(
        conn,
        article,
        fetch_html=_fetch_html,
        extract=_extract(extracted),
        summarize=_fake_summarize(error, []),
        now=lambda: NOW,
    )

    assert ok is False
    status, failure_count, last_error, content = _row(
        conn, article.id, ["status", "failure_count", "last_error", "content"]
    )
    assert (status, failure_count) == ("failed", 1)
    assert "종료 코드 1" in last_error
    assert conn.execute("SELECT COUNT(*) FROM summaries").fetchone()[0] == 0
    assert content == extracted


def test_summarize_article_claude_unavailable_propagates_and_leaves_pending(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = _only_pending(conn)

    def raising_summarize(body: str, tags: Sequence[str]) -> SummaryResult:
        raise ClaudeUnavailableError("claude 없음")

    with pytest.raises(ClaudeUnavailableError):
        summarize_article(
            conn,
            article,
            fetch_html=_fetch_html,
            extract=_extract("x" * 250),
            summarize=raising_summarize,
            now=lambda: NOW,
        )

    status, failure_count, last_error = _row(
        conn, article.id, ["status", "failure_count", "last_error"]
    )
    assert (status, failure_count, last_error) == ("pending", 0, None)
    assert conn.execute("SELECT COUNT(*) FROM summaries").fetchone()[0] == 0


def test_summarize_article_unexpected_exception_propagates_without_failure_count(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = _only_pending(conn)

    def raising_summarize(body: str, tags: Sequence[str]) -> SummaryResult:
        raise RuntimeError("kaboom")

    with pytest.raises(RuntimeError, match="kaboom"):
        summarize_article(
            conn,
            article,
            fetch_html=_fetch_html,
            extract=_extract("x" * 250),
            summarize=raising_summarize,
            now=lambda: NOW,
        )

    failure_count = _row(conn, article.id, ["failure_count"])[0]
    assert failure_count == 0


def test_summarize_article_no_body_returns_false_without_calling_summarize(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link=None, content=None))
    article = _only_pending(conn)
    calls: list[tuple[str, list[str]]] = []

    ok = summarize_article(
        conn,
        article,
        fetch_html=_fetch_html,
        extract=_extract(None),
        summarize=_fake_summarize(
            SummaryResult(summary=["a", "b", "c"], key_points=["p"], tags=[]), calls
        ),
        now=lambda: NOW,
    )

    assert ok is False
    assert calls == []
    failure_count = _row(conn, article.id, ["failure_count"])[0]
    assert failure_count == 1


def test_summarize_article_retry_uses_saved_plain_text_as_feed_content(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1", content=None))
    article = _only_pending(conn)
    extracted1 = "x" * 250

    ok1 = summarize_article(
        conn,
        article,
        fetch_html=_fetch_html,
        extract=_extract(extracted1),
        summarize=_fake_summarize(SummaryCallError("claude 종료 코드 1: x"), []),
        now=lambda: NOW,
    )
    assert ok1 is False

    article_retry = _only_pending(conn)

    def fail_fetch(url: str) -> str:
        raise ArticleFetchError("boom")

    calls: list[tuple[str, list[str]]] = []
    result = SummaryResult(summary=["a", "b", "c"], key_points=["p"], tags=[])

    ok2 = summarize_article(
        conn,
        article_retry,
        fetch_html=fail_fetch,
        extract=_extract("unused"),
        summarize=_fake_summarize(result, calls),
        now=lambda: NOW,
    )

    assert ok2 is True
    assert calls[0][0] == extracted1
    status, failure_count, last_error = _row(
        conn, article.id, ["status", "failure_count", "last_error"]
    )
    assert (status, failure_count, last_error) == ("summarized", 0, None)


def test_save_summary_partial_insert_rolls_back_on_unique_violation(
    conn: sqlite3.Connection,
) -> None:
    _register(conn, Entry(key="k1", link="https://x.example.com/1"))
    article = _only_pending(conn)
    conn.execute("INSERT INTO tags (name) VALUES (?)", ("old-tag",))
    conn.execute(
        "INSERT INTO summaries (article_id, summary_lines, key_points, created_at) "
        "VALUES (?, ?, ?, ?)",
        (article.id, "[]", "[]", NOW),
    )
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError, match="UNIQUE"):
        save_summary(conn, article.id, ["a", "b", "c"], ["p"], ["new-tag"], NOW)

    tag_names = {
        row[0] for row in conn.execute("SELECT name FROM tags").fetchall()
    }
    assert tag_names == {"old-tag"}
    article_tags_count = conn.execute(
        "SELECT COUNT(*) FROM article_tags WHERE article_id = ?", (article.id,)
    ).fetchone()[0]
    assert article_tags_count == 0
    status = conn.execute(
        "SELECT status FROM articles WHERE id = ?", (article.id,)
    ).fetchone()[0]
    assert status == "pending"
    assert conn.in_transaction is False


def test_list_tag_names_sorted_and_empty(conn: sqlite3.Connection) -> None:
    assert list_tag_names(conn) == []

    for name in ("b", "a", "c"):
        conn.execute("INSERT INTO tags (name) VALUES (?)", (name,))
    conn.commit()

    assert list_tag_names(conn) == ["a", "b", "c"]
