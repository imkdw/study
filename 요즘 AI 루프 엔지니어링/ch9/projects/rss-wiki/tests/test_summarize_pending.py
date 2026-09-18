from __future__ import annotations

import sqlite3
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import pytest

from rss_wiki.db import (
    GIVE_UP_THRESHOLD,
    PendingArticle,
    connect,
    get_or_create_feed,
    list_pending_articles,
    register_entries,
)
from rss_wiki.pipeline import SummarizeResult, summarize_article, summarize_pending
from rss_wiki.summarize import ClaudeUnavailableError, SummaryCallError

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


def _make_articles(conn: sqlite3.Connection, count: int) -> list[PendingArticle]:
    feed_id = get_or_create_feed(conn, FEED_URL, None)
    entries = [Entry(key=f"k{i}") for i in range(count)]
    register_entries(conn, feed_id, entries, NOW)
    return list_pending_articles(conn, limit=count)


def _fake_list_articles(
    articles: Sequence[PendingArticle], calls: list[tuple]
) -> Callable[[sqlite3.Connection, int], Sequence[PendingArticle]]:
    def fn(conn: sqlite3.Connection, limit: int) -> Sequence[PendingArticle]:
        calls.append(("list_articles", limit))
        return articles

    return fn


def _fake_check(calls: list[tuple]) -> Callable[[], None]:
    def fn() -> None:
        calls.append(("check",))

    return fn


def _fake_summarize_one(
    results: dict[int, bool | BaseException], calls: list[tuple]
) -> Callable[[sqlite3.Connection, PendingArticle], bool]:
    def fn(conn: sqlite3.Connection, article: PendingArticle) -> bool:
        calls.append(("summarize_one", article.id))
        outcome = results[article.id]
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome

    return fn


def test_summarize_pending_all_succeed(conn: sqlite3.Connection) -> None:
    articles = _make_articles(conn, 3)
    calls: list[tuple] = []
    results = {article.id: True for article in articles}

    result = summarize_pending(
        conn,
        max_summaries=10,
        list_articles=_fake_list_articles(articles, calls),
        summarize_one=_fake_summarize_one(results, calls),
        check=_fake_check(calls),
    )

    assert result == SummarizeResult(3, 0, 0)
    assert len([c for c in calls if c[0] == "check"]) == 1


def test_summarize_pending_passes_max_summaries_as_limit(conn: sqlite3.Connection) -> None:
    articles = _make_articles(conn, 1)
    calls: list[tuple] = []
    results = {article.id: True for article in articles}

    summarize_pending(
        conn,
        max_summaries=2,
        list_articles=_fake_list_articles(articles, calls),
        summarize_one=_fake_summarize_one(results, calls),
        check=_fake_check(calls),
    )

    list_calls = [c for c in calls if c[0] == "list_articles"]
    assert len(list_calls) == 1
    assert list_calls[0][1] == 2


def test_summarize_pending_given_up_is_delta_not_raw_count(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, FEED_URL, None)
    conn.execute(
        "INSERT INTO articles (feed_id, key, status, failure_count, created_at) "
        "VALUES (?, 'old-given-up', 'given_up', ?, ?)",
        (feed_id, GIVE_UP_THRESHOLD, NOW),
    )
    conn.commit()
    articles = _make_articles(conn, 2)
    calls: list[tuple] = []
    results = {article.id: True for article in articles}

    result = summarize_pending(
        conn,
        max_summaries=10,
        list_articles=_fake_list_articles(articles, calls),
        summarize_one=_fake_summarize_one(results, calls),
        check=_fake_check(calls),
    )

    assert result == SummarizeResult(2, 0, 0)


def test_summarize_pending_counts_success_and_failure(conn: sqlite3.Connection) -> None:
    articles = _make_articles(conn, 2)
    calls: list[tuple] = []
    results = {articles[0].id: True, articles[1].id: False}

    result = summarize_pending(
        conn,
        max_summaries=10,
        list_articles=_fake_list_articles(articles, calls),
        summarize_one=_fake_summarize_one(results, calls),
        check=_fake_check(calls),
    )

    assert result.succeeded == 1
    assert result.failed == 1


def test_summarize_pending_empty_list_skips_check_and_summarize(
    conn: sqlite3.Connection,
) -> None:
    calls: list[tuple] = []

    result = summarize_pending(
        conn,
        max_summaries=10,
        list_articles=_fake_list_articles([], calls),
        summarize_one=_fake_summarize_one({}, calls),
        check=_fake_check(calls),
    )

    assert result == SummarizeResult(0, 0, 0)
    assert [c[0] for c in calls if c[0] in ("check", "summarize_one")] == []


def test_summarize_pending_zero_max_summaries_calls_nothing(
    conn: sqlite3.Connection,
) -> None:
    calls: list[tuple] = []

    result = summarize_pending(
        conn,
        max_summaries=0,
        list_articles=_fake_list_articles([], calls),
        summarize_one=_fake_summarize_one({}, calls),
        check=_fake_check(calls),
    )

    assert result == SummarizeResult(0, 0, 0)
    assert calls == []


def test_summarize_pending_negative_max_summaries_calls_nothing(
    conn: sqlite3.Connection,
) -> None:
    calls: list[tuple] = []

    result = summarize_pending(
        conn,
        max_summaries=-1,
        list_articles=_fake_list_articles([], calls),
        summarize_one=_fake_summarize_one({}, calls),
        check=_fake_check(calls),
    )

    assert result == SummarizeResult(0, 0, 0)
    assert calls == []


def test_summarize_pending_check_error_propagates_without_summarize(
    conn: sqlite3.Connection,
) -> None:
    articles = _make_articles(conn, 1)
    calls: list[tuple] = []

    def raising_check() -> None:
        calls.append(("check",))
        raise ClaudeUnavailableError("claude 없음")

    with pytest.raises(ClaudeUnavailableError):
        summarize_pending(
            conn,
            max_summaries=10,
            list_articles=_fake_list_articles(articles, calls),
            summarize_one=_fake_summarize_one({articles[0].id: True}, calls),
            check=raising_check,
        )

    assert [c[0] for c in calls if c[0] == "summarize_one"] == []


def test_summarize_pending_summarize_one_error_propagates_and_stops(
    conn: sqlite3.Connection,
) -> None:
    articles = _make_articles(conn, 3)
    calls: list[tuple] = []
    results = {
        articles[0].id: True,
        articles[1].id: ClaudeUnavailableError("claude 없음"),
        articles[2].id: True,
    }

    with pytest.raises(ClaudeUnavailableError):
        summarize_pending(
            conn,
            max_summaries=10,
            list_articles=_fake_list_articles(articles, calls),
            summarize_one=_fake_summarize_one(results, calls),
            check=_fake_check(calls),
        )

    assert len([c for c in calls if c[0] == "summarize_one"]) == 2


def test_summarize_pending_call_order_check_first_and_once(
    conn: sqlite3.Connection,
) -> None:
    articles = _make_articles(conn, 3)
    calls: list[tuple] = []
    results = {article.id: True for article in articles}

    summarize_pending(
        conn,
        max_summaries=10,
        list_articles=_fake_list_articles(articles, calls),
        summarize_one=_fake_summarize_one(results, calls),
        check=_fake_check(calls),
    )

    kinds = [c[0] for c in calls if c[0] in ("check", "summarize_one")]
    assert kinds[0] == "check"
    assert kinds.count("check") == 1


def test_summarize_pending_integration_gives_up_on_third_failure(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, FEED_URL, None)
    register_entries(conn, feed_id, [Entry(key="k1", link=None, content="본문 " * 100)], NOW)

    def fake_summarize(body: str, tags: Sequence[str]) -> None:
        raise SummaryCallError("claude 종료 코드 1: x")

    check_calls: list[str] = []

    def fake_check() -> None:
        check_calls.append("check")

    def summarize_one(conn: sqlite3.Connection, article: PendingArticle) -> bool:
        return summarize_article(conn, article, summarize=fake_summarize)

    results = []
    for _ in range(4):
        results.append(
            summarize_pending(
                conn,
                max_summaries=10,
                summarize_one=summarize_one,
                check=fake_check,
            )
        )

    assert (results[0].succeeded, results[0].failed, results[0].given_up) == (0, 1, 0)
    assert (results[1].succeeded, results[1].failed, results[1].given_up) == (0, 1, 0)
    assert (results[2].succeeded, results[2].failed, results[2].given_up) == (0, 1, 1)

    status, failure_count = conn.execute(
        "SELECT status, failure_count FROM articles WHERE key = 'k1'"
    ).fetchone()
    assert (status, failure_count) == ("given_up", GIVE_UP_THRESHOLD)

    assert results[3] == SummarizeResult(0, 0, 0)
    assert len(check_calls) == 3
