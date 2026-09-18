from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterator

import pytest

from rss_wiki.config import FeedConfig
from rss_wiki.db import connect
from rss_wiki.fetch import FeedEntry, FeedFetchError, FeedParseError, ParsedFeed
from rss_wiki.pipeline import CollectResult, collect

NOW = "2026-09-18T00:13:02+09:00"


@pytest.fixture
def conn(tmp_path: Path) -> Iterator[sqlite3.Connection]:
    connection = connect(tmp_path / "rss-wiki.db")
    try:
        yield connection
    finally:
        connection.close()


def _entries(n: int, prefix: str, base_day: int = 1) -> list[FeedEntry]:
    return [
        FeedEntry(
            key=f"{prefix}-{i}",
            title=None,
            link=None,
            published_at=f"2026-09-{base_day + i:02d}T00:00:00+09:00",
            content=None,
        )
        for i in range(n)
    ]


def test_collect_two_feeds_success_records_new_articles_and_success(
    conn: sqlite3.Connection,
) -> None:
    feed_a = FeedConfig(url="https://a.example.com/feed.xml")
    feed_b = FeedConfig(url="https://b.example.com/feed.xml")
    parsed = {
        feed_a.url: ParsedFeed(title="A", entries=_entries(3, "a")),
        feed_b.url: ParsedFeed(title="B", entries=_entries(2, "b")),
    }

    def fake_fetch(url: str) -> ParsedFeed:
        return parsed[url]

    result = collect(conn, [feed_a, feed_b], fetch=fake_fetch, now=lambda: NOW)

    assert result == CollectResult(new_articles=5, failed_feeds=0, given_up_feeds=0)
    rows = conn.execute(
        "SELECT last_fetched_at, consecutive_failures FROM feeds"
    ).fetchall()
    assert len(rows) == 2
    assert all(row == (NOW, 0) for row in rows)


def test_collect_one_feed_fetch_error_records_failure_other_succeeds(
    conn: sqlite3.Connection,
) -> None:
    feed_a = FeedConfig(url="https://a.example.com/feed.xml")
    feed_b = FeedConfig(url="https://b.example.com/feed.xml")

    def fake_fetch(url: str) -> ParsedFeed:
        if url == feed_a.url:
            raise FeedFetchError("boom")
        return ParsedFeed(title="B", entries=_entries(2, "b"))

    result = collect(conn, [feed_a, feed_b], fetch=fake_fetch, now=lambda: NOW)

    assert result.failed_feeds == 1
    assert result.new_articles == 2
    row = conn.execute(
        "SELECT consecutive_failures, last_error, last_fetched_at FROM feeds "
        "WHERE url = ?",
        (feed_a.url,),
    ).fetchone()
    assert row[0] == 1
    assert "boom" in row[1]
    assert row[2] is None
    b_feed_id = conn.execute(
        "SELECT id FROM feeds WHERE url = ?", (feed_b.url,)
    ).fetchone()[0]
    b_article_count = conn.execute(
        "SELECT COUNT(*) FROM articles WHERE feed_id = ?", (b_feed_id,)
    ).fetchone()[0]
    assert b_article_count == 2
    b_row = conn.execute(
        "SELECT last_fetched_at, consecutive_failures FROM feeds WHERE id = ?",
        (b_feed_id,),
    ).fetchone()
    assert b_row == (NOW, 0)


def test_collect_repeated_failures_accumulate_then_reset_on_success(
    conn: sqlite3.Connection,
) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml")

    def failing_fetch(url: str) -> ParsedFeed:
        raise FeedFetchError("fail")

    collect(conn, [feed], fetch=failing_fetch, now=lambda: NOW)
    collect(conn, [feed], fetch=failing_fetch, now=lambda: NOW)

    row = conn.execute(
        "SELECT consecutive_failures FROM feeds WHERE url = ?", (feed.url,)
    ).fetchone()
    assert row[0] == 2

    def succeeding_fetch(url: str) -> ParsedFeed:
        return ParsedFeed(title="A", entries=_entries(1, "a"))

    collect(conn, [feed], fetch=succeeding_fetch, now=lambda: NOW)

    row = conn.execute(
        "SELECT consecutive_failures, last_error FROM feeds WHERE url = ?",
        (feed.url,),
    ).fetchone()
    assert row == (0, None)


def test_collect_feed_parse_error_records_failure_like_fetch_error(
    conn: sqlite3.Connection,
) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml")

    def fake_fetch(url: str) -> ParsedFeed:
        raise FeedParseError("bad xml")

    result = collect(conn, [feed], fetch=fake_fetch, now=lambda: NOW)

    assert result.failed_feeds == 1
    row = conn.execute(
        "SELECT consecutive_failures, last_error FROM feeds WHERE url = ?",
        (feed.url,),
    ).fetchone()
    assert row[0] == 1
    assert "bad xml" in row[1]


def test_collect_register_entries_error_records_failure_others_succeed(
    conn: sqlite3.Connection,
) -> None:
    feed_bad = FeedConfig(url="https://bad.example.com/feed.xml")
    feed_ok = FeedConfig(url="https://ok.example.com/feed.xml")
    bad_entry = FeedEntry(
        key="bad",
        title=["bad"],  # type: ignore[arg-type]
        link=None,
        published_at="2026-01-01T00:00:00+09:00",
        content=None,
    )

    def fake_fetch(url: str) -> ParsedFeed:
        if url == feed_bad.url:
            return ParsedFeed(title="Bad", entries=[bad_entry])
        return ParsedFeed(title="Ok", entries=_entries(2, "ok"))

    result = collect(conn, [feed_bad, feed_ok], fetch=fake_fetch, now=lambda: NOW)

    assert result.failed_feeds == 1
    assert result.new_articles == 2
    bad_feed_id = conn.execute(
        "SELECT id FROM feeds WHERE url = ?", (feed_bad.url,)
    ).fetchone()[0]
    assert (
        conn.execute(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?", (bad_feed_id,)
        ).fetchone()[0]
        == 0
    )
    assert (
        conn.execute(
            "SELECT COUNT(*) FROM skipped_keys WHERE feed_id = ?", (bad_feed_id,)
        ).fetchone()[0]
        == 0
    )
    assert conn.in_transaction is False


def test_collect_failure_record_persists_after_reconnect(tmp_path: Path) -> None:
    db_path = tmp_path / "rss-wiki.db"
    conn = connect(db_path)
    feed = FeedConfig(url="https://bad.example.com/feed.xml")
    bad_entry = FeedEntry(
        key="bad",
        title=["bad"],  # type: ignore[arg-type]
        link=None,
        published_at="2026-01-01T00:00:00+09:00",
        content=None,
    )

    def fake_fetch(url: str) -> ParsedFeed:
        return ParsedFeed(title="Bad", entries=[bad_entry])

    collect(conn, [feed], fetch=fake_fetch, now=lambda: NOW)
    conn.close()

    conn2 = connect(db_path)
    try:
        row = conn2.execute(
            "SELECT consecutive_failures FROM feeds WHERE url = ?", (feed.url,)
        ).fetchone()
        assert row[0] == 1
    finally:
        conn2.close()


def test_collect_feed_missing_from_config_is_not_touched(
    conn: sqlite3.Connection,
) -> None:
    feed_a = FeedConfig(url="https://a.example.com/feed.xml")
    feed_b = FeedConfig(url="https://b.example.com/feed.xml")
    parsed = {
        feed_a.url: ParsedFeed(title="A", entries=_entries(2, "a")),
        feed_b.url: ParsedFeed(title="B", entries=_entries(2, "b")),
    }
    calls: list[str] = []

    def fake_fetch(url: str) -> ParsedFeed:
        calls.append(url)
        return parsed[url]

    collect(conn, [feed_a, feed_b], fetch=fake_fetch, now=lambda: NOW)

    b_feed_id = conn.execute(
        "SELECT id FROM feeds WHERE url = ?", (feed_b.url,)
    ).fetchone()[0]
    before_count = conn.execute(
        "SELECT COUNT(*) FROM articles WHERE feed_id = ?", (b_feed_id,)
    ).fetchone()[0]
    before_row = conn.execute(
        "SELECT last_fetched_at, consecutive_failures FROM feeds WHERE id = ?",
        (b_feed_id,),
    ).fetchone()

    calls.clear()
    collect(conn, [feed_a], fetch=fake_fetch, now=lambda: "2026-09-19T00:00:00+09:00")

    assert feed_b.url not in calls
    after_count = conn.execute(
        "SELECT COUNT(*) FROM articles WHERE feed_id = ?", (b_feed_id,)
    ).fetchone()[0]
    after_row = conn.execute(
        "SELECT last_fetched_at, consecutive_failures FROM feeds WHERE id = ?",
        (b_feed_id,),
    ).fetchone()
    assert after_count == before_count
    assert after_row == before_row


def test_collect_second_run_new_articles_counts_only_new_keys(
    conn: sqlite3.Connection,
) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml")
    first_entries = _entries(3, "a")

    def fake_fetch_first(url: str) -> ParsedFeed:
        return ParsedFeed(title="A", entries=first_entries)

    collect(conn, [feed], fetch=fake_fetch_first, now=lambda: NOW)

    new_entries = first_entries + _entries(2, "a-new", base_day=50)

    def fake_fetch_second(url: str) -> ParsedFeed:
        return ParsedFeed(title="A", entries=new_entries)

    result = collect(conn, [feed], fetch=fake_fetch_second, now=lambda: NOW)

    assert result.new_articles == 2


def test_collect_records_parsed_title_as_name_and_keeps_it_on_failure(
    conn: sqlite3.Connection,
) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml", name=None)

    def fake_fetch_success(url: str) -> ParsedFeed:
        return ParsedFeed(title="Parsed Title", entries=_entries(1, "a"))

    collect(conn, [feed], fetch=fake_fetch_success, now=lambda: NOW)
    name = conn.execute(
        "SELECT name FROM feeds WHERE url = ?", (feed.url,)
    ).fetchone()[0]
    assert name == "Parsed Title"

    def fake_fetch_fail(url: str) -> ParsedFeed:
        raise FeedFetchError("down")

    collect(conn, [feed], fetch=fake_fetch_fail, now=lambda: NOW)
    name_after = conn.execute(
        "SELECT name FROM feeds WHERE url = ?", (feed.url,)
    ).fetchone()[0]
    assert name_after == "Parsed Title"


def test_collect_config_name_overrides_parsed_title(
    conn: sqlite3.Connection,
) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml", name="Configured Name")

    def fake_fetch(url: str) -> ParsedFeed:
        return ParsedFeed(title="Parsed Title", entries=_entries(1, "a"))

    collect(conn, [feed], fetch=fake_fetch, now=lambda: NOW)
    name = conn.execute(
        "SELECT name FROM feeds WHERE url = ?", (feed.url,)
    ).fetchone()[0]
    assert name == "Configured Name"


def test_collect_calls_now_once_per_feed_uses_same_value_for_articles_and_feed(
    conn: sqlite3.Connection,
) -> None:
    feed_a = FeedConfig(url="https://a.example.com/feed.xml")
    feed_b = FeedConfig(url="https://b.example.com/feed.xml")
    now_values = iter(
        [
            "2026-09-18T00:00:01+09:00",
            "2026-09-18T00:00:02+09:00",
        ]
    )
    calls: list[str] = []

    def counting_now() -> str:
        value = next(now_values)
        calls.append(value)
        return value

    def fake_fetch(url: str) -> ParsedFeed:
        if url == feed_a.url:
            return ParsedFeed(title="A", entries=_entries(3, "a"))
        return ParsedFeed(title="B", entries=_entries(2, "b"))

    collect(conn, [feed_a, feed_b], fetch=fake_fetch, now=counting_now)

    assert len(calls) == 2
    feed_a_id = conn.execute(
        "SELECT id FROM feeds WHERE url = ?", (feed_a.url,)
    ).fetchone()[0]
    feed_b_id = conn.execute(
        "SELECT id FROM feeds WHERE url = ?", (feed_b.url,)
    ).fetchone()[0]
    created_ats_a = {
        row[0]
        for row in conn.execute(
            "SELECT created_at FROM articles WHERE feed_id = ?", (feed_a_id,)
        ).fetchall()
    }
    created_ats_b = {
        row[0]
        for row in conn.execute(
            "SELECT created_at FROM articles WHERE feed_id = ?", (feed_b_id,)
        ).fetchall()
    }
    last_fetched_at_a = conn.execute(
        "SELECT last_fetched_at FROM feeds WHERE id = ?", (feed_a_id,)
    ).fetchone()[0]
    last_fetched_at_b = conn.execute(
        "SELECT last_fetched_at FROM feeds WHERE id = ?", (feed_b_id,)
    ).fetchone()[0]
    assert created_ats_a == {"2026-09-18T00:00:01+09:00"}
    assert last_fetched_at_a == "2026-09-18T00:00:01+09:00"
    assert created_ats_b == {"2026-09-18T00:00:02+09:00"}
    assert last_fetched_at_b == "2026-09-18T00:00:02+09:00"


def test_collect_new_articles_zero_still_records_success(
    conn: sqlite3.Connection,
) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml")
    entries = _entries(2, "a")
    now1 = "2026-09-18T00:00:01+09:00"
    now2 = "2026-09-18T00:00:02+09:00"

    def fake_fetch_success(url: str) -> ParsedFeed:
        return ParsedFeed(title="A", entries=entries)

    collect(conn, [feed], fetch=fake_fetch_success, now=lambda: now1)

    def fake_fetch_fail(url: str) -> ParsedFeed:
        raise FeedFetchError("boom")

    collect(conn, [feed], fetch=fake_fetch_fail, now=lambda: now1)
    row = conn.execute(
        "SELECT consecutive_failures FROM feeds WHERE url = ?", (feed.url,)
    ).fetchone()
    assert row[0] == 1

    result = collect(conn, [feed], fetch=fake_fetch_success, now=lambda: now2)

    assert result.new_articles == 0
    row = conn.execute(
        "SELECT last_fetched_at, consecutive_failures, last_error FROM feeds "
        "WHERE url = ?",
        (feed.url,),
    ).fetchone()
    assert row == (now2, 0, None)


def test_collect_propagates_unexpected_exceptions(conn: sqlite3.Connection) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml")

    def fake_fetch(url: str) -> ParsedFeed:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError, match="boom"):
        collect(conn, [feed], fetch=fake_fetch, now=lambda: NOW)


def test_collect_given_up_feed_skips_fetch_and_counts_given_up(
    conn: sqlite3.Connection,
) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml")
    conn.execute(
        "INSERT INTO feeds (url, consecutive_failures) VALUES (?, 3)", (feed.url,)
    )
    conn.commit()
    calls: list[str] = []

    def fake_fetch(url: str) -> ParsedFeed:
        calls.append(url)
        return ParsedFeed(title="A", entries=_entries(1, "a"))

    result = collect(conn, [feed], fetch=fake_fetch, now=lambda: NOW)

    assert calls == []
    assert result.given_up_feeds == 1
    assert result.failed_feeds == 0
    assert result.new_articles == 0
    row = conn.execute(
        "SELECT consecutive_failures, last_fetched_at, last_error FROM feeds WHERE url = ?",
        (feed.url,),
    ).fetchone()
    assert row == (3, None, None)


def test_collect_feed_below_threshold_still_fetches(
    conn: sqlite3.Connection,
) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml")
    conn.execute(
        "INSERT INTO feeds (url, consecutive_failures) VALUES (?, 2)", (feed.url,)
    )
    conn.commit()
    calls: list[str] = []

    def fake_fetch(url: str) -> ParsedFeed:
        calls.append(url)
        return ParsedFeed(title="A", entries=_entries(1, "a"))

    result = collect(conn, [feed], fetch=fake_fetch, now=lambda: NOW)

    assert calls == [feed.url]
    assert result.given_up_feeds == 0
    row = conn.execute(
        "SELECT consecutive_failures FROM feeds WHERE url = ?", (feed.url,)
    ).fetchone()
    assert row[0] == 0


def test_collect_feed_transitions_to_given_up_on_third_failure(
    conn: sqlite3.Connection,
) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml")
    calls: list[str] = []

    def failing_fetch(url: str) -> ParsedFeed:
        calls.append(url)
        raise FeedFetchError("fail")

    results = [
        collect(conn, [feed], fetch=failing_fetch, now=lambda: NOW) for _ in range(4)
    ]

    assert len(calls) == 3
    assert [r.failed_feeds for r in results[:3]] == [1, 1, 1]
    assert [r.given_up_feeds for r in results[:3]] == [0, 0, 0]
    assert results[3].failed_feeds == 0
    assert results[3].given_up_feeds == 1
    row = conn.execute(
        "SELECT consecutive_failures FROM feeds WHERE url = ?", (feed.url,)
    ).fetchone()
    assert row[0] == 3


def test_collect_given_up_feed_does_not_block_other_feeds(
    conn: sqlite3.Connection,
) -> None:
    feed_a = FeedConfig(url="https://a.example.com/feed.xml")
    feed_b = FeedConfig(url="https://b.example.com/feed.xml")
    conn.execute(
        "INSERT INTO feeds (url, consecutive_failures) VALUES (?, 3)", (feed_a.url,)
    )
    conn.commit()
    calls: list[str] = []

    def fake_fetch(url: str) -> ParsedFeed:
        calls.append(url)
        return ParsedFeed(title="B", entries=_entries(2, "b"))

    result = collect(conn, [feed_a, feed_b], fetch=fake_fetch, now=lambda: NOW)

    assert calls == [feed_b.url]
    assert result.given_up_feeds == 1
    assert result.new_articles == 2


def test_collect_failure_recording_db_error_propagates(
    conn: sqlite3.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    feed = FeedConfig(url="https://a.example.com/feed.xml")

    def fake_fetch(url: str) -> ParsedFeed:
        raise FeedFetchError("boom")

    def broken_record_feed_failure(*args: object, **kwargs: object) -> None:
        raise sqlite3.OperationalError("disk I/O error")

    monkeypatch.setattr(
        "rss_wiki.pipeline.record_feed_failure", broken_record_feed_failure
    )

    with pytest.raises(sqlite3.OperationalError, match="disk I/O error"):
        collect(conn, [feed], fetch=fake_fetch, now=lambda: NOW)
