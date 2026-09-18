from __future__ import annotations

import random
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

import pytest

from rss_wiki.db import connect, get_or_create_feed, register_entries

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


def _dated_entries(n: int, base_day: int = 1, prefix: str = "key") -> list[Entry]:
    return [
        Entry(key=f"{prefix}-{i}", published_at=f"2026-09-{base_day + i:02d}T00:00:00+09:00")
        for i in range(n)
    ]


def _mixed_offset_entries(n: int, prefix: str = "mix") -> list[Entry]:
    base = datetime(2026, 9, 1, tzinfo=timezone.utc)
    entries = []
    for i in range(n):
        instant = base + timedelta(hours=i)
        if i % 2 == 0:
            value = instant.isoformat()
        else:
            value = instant.astimezone(timezone(timedelta(hours=9))).isoformat()
        entries.append(Entry(key=f"{prefix}-{i}", published_at=value))
    return entries


def test_get_or_create_feed_returns_same_id_and_updates_name(
    conn: sqlite3.Connection,
) -> None:
    feed_id1 = get_or_create_feed(conn, "https://example.com/feed.xml", "Old Name")
    feed_id2 = get_or_create_feed(conn, "https://example.com/feed.xml", "New Name")

    assert feed_id1 == feed_id2
    name = conn.execute(
        "SELECT name FROM feeds WHERE id = ?", (feed_id1,)
    ).fetchone()[0]
    assert name == "New Name"


def test_get_or_create_feed_none_name_does_not_clear_existing_name(
    conn: sqlite3.Connection,
) -> None:
    feed_id1 = get_or_create_feed(conn, "https://example.com/feed.xml", "Old Name")
    feed_id2 = get_or_create_feed(conn, "https://example.com/feed.xml", None)

    assert feed_id1 == feed_id2
    name = conn.execute(
        "SELECT name FROM feeds WHERE id = ?", (feed_id1,)
    ).fetchone()[0]
    assert name == "Old Name"


def test_first_run_registers_only_latest_ten_by_published_at(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    entries = _dated_entries(15)
    shuffled = entries[:]
    random.Random(0).shuffle(shuffled)

    inserted = register_entries(conn, feed_id, shuffled, NOW)

    assert inserted == 10
    article_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM articles WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert article_keys == {entry.key for entry in entries[5:]}

    skipped_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM skipped_keys WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert skipped_keys == {entry.key for entry in entries[:5]}


def test_second_run_registers_new_keys_and_does_not_reregister_skipped(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    entries = _dated_entries(15)
    register_entries(conn, feed_id, entries, NOW)

    new_entries = _dated_entries(2, base_day=100, prefix="new")
    inserted = register_entries(conn, feed_id, entries + new_entries, NOW)

    assert inserted == 2
    article_count = conn.execute(
        "SELECT COUNT(*) FROM articles WHERE feed_id = ?", (feed_id,)
    ).fetchone()[0]
    assert article_count == 12
    skipped_count = conn.execute(
        "SELECT COUNT(*) FROM skipped_keys WHERE feed_id = ?", (feed_id,)
    ).fetchone()[0]
    assert skipped_count == 5


def test_second_run_new_keys_are_present_in_articles(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    entries = _dated_entries(15)
    register_entries(conn, feed_id, entries, NOW)

    new_entries = _dated_entries(2, base_day=100, prefix="new")
    register_entries(conn, feed_id, entries + new_entries, NOW)

    article_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM articles WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert {entry.key for entry in new_entries} <= article_keys


def test_first_run_with_fewer_than_limit_registers_all_and_no_skips(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    entries = _dated_entries(7)

    inserted = register_entries(conn, feed_id, entries, NOW)

    assert inserted == 7
    skipped_count = conn.execute(
        "SELECT COUNT(*) FROM skipped_keys WHERE feed_id = ?", (feed_id,)
    ).fetchone()[0]
    assert skipped_count == 0


def test_first_run_excludes_entries_without_published_at_first(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    dated = _dated_entries(10)
    undated = [Entry(key=f"undated-{i}") for i in range(2)]

    inserted = register_entries(conn, feed_id, dated + undated, NOW)

    assert inserted == 10
    article_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM articles WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert article_keys == {entry.key for entry in dated}

    skipped_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM skipped_keys WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert skipped_keys == {entry.key for entry in undated}


def test_duplicate_key_within_call_registers_once(conn: sqlite3.Connection) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    entries = [
        Entry(key="dup", title="first", published_at="2026-09-01T00:00:00+09:00"),
        Entry(key="dup", title="second", published_at="2026-09-02T00:00:00+09:00"),
    ]

    inserted = register_entries(conn, feed_id, entries, NOW)

    assert inserted == 1
    title = conn.execute(
        "SELECT title FROM articles WHERE feed_id = ? AND key = 'dup'", (feed_id,)
    ).fetchone()[0]
    assert title == "first"


def test_same_key_in_different_feeds_do_not_interfere(
    conn: sqlite3.Connection,
) -> None:
    feed_id_a = get_or_create_feed(conn, "https://a.example.com/feed.xml", None)
    feed_id_b = get_or_create_feed(conn, "https://b.example.com/feed.xml", None)
    entries = [Entry(key="shared", published_at="2026-09-01T00:00:00+09:00")]

    inserted_a = register_entries(conn, feed_id_a, entries, NOW)
    inserted_b = register_entries(conn, feed_id_b, entries, NOW)

    assert inserted_a == 1
    assert inserted_b == 1


def test_registered_article_created_at_matches_now_argument(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    entries = [Entry(key="a-1", published_at="2026-09-01T00:00:00+09:00")]

    register_entries(conn, feed_id, entries, NOW)

    created_at = conn.execute(
        "SELECT created_at FROM articles WHERE feed_id = ? AND key = 'a-1'",
        (feed_id,),
    ).fetchone()[0]
    assert created_at == NOW


def test_first_run_skipped_keys_created_at_matches_now_argument(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    entries = _dated_entries(15)

    register_entries(conn, feed_id, entries, NOW)

    created_ats = {
        row[0]
        for row in conn.execute(
            "SELECT created_at FROM skipped_keys WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert created_ats == {NOW}


def test_first_run_tie_published_at_keeps_feed_order(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    same_time = "2026-09-01T00:00:00+09:00"
    entries = [Entry(key=f"key-{i}", published_at=same_time) for i in range(12)]

    inserted = register_entries(conn, feed_id, entries, NOW)

    assert inserted == 10
    article_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM articles WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert article_keys == {f"key-{i}" for i in range(10)}

    skipped_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM skipped_keys WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert skipped_keys == {"key-10", "key-11"}


def test_first_run_mixed_offset_published_at_skips_oldest_by_absolute_time(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    entries = _mixed_offset_entries(12)

    inserted = register_entries(conn, feed_id, entries, NOW)

    assert inserted == 10
    skipped_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM skipped_keys WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert skipped_keys == {"mix-0", "mix-1"}


def test_register_with_missing_feed_id_rolls_back(conn: sqlite3.Connection) -> None:
    entries = _dated_entries(1)

    with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
        register_entries(conn, 9999, entries, NOW)

    assert conn.in_transaction is False
    assert conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0] == 0
    assert conn.execute("SELECT COUNT(*) FROM skipped_keys").fetchone()[0] == 0


def test_first_run_unparseable_published_at_sent_to_skipped(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    dated = _dated_entries(11)
    garbage = Entry(key="garbage", published_at="garbage")

    inserted = register_entries(conn, feed_id, dated + [garbage], NOW)

    assert inserted == 10
    skipped_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM skipped_keys WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert skipped_keys == {"key-0", "garbage"}


def test_first_run_naive_published_at_sent_to_skipped(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    dated = _dated_entries(11)
    naive = Entry(key="naive", published_at="2026-09-18T00:00:00")

    inserted = register_entries(conn, feed_id, dated + [naive], NOW)

    assert inserted == 10
    skipped_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM skipped_keys WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert skipped_keys == {"key-0", "naive"}


def _register_entries_with_unbindable_title_rolls_back(
    conn: sqlite3.Connection, feed_id: int
) -> None:
    dated = _dated_entries(4)
    bad = Entry(key="bad", title=["bad"], published_at="2026-01-01T00:00:00+09:00")
    with pytest.raises(sqlite3.ProgrammingError):
        register_entries(conn, feed_id, dated + [bad], NOW)


def test_first_run_partial_insert_failure_rolls_back_everything(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)

    _register_entries_with_unbindable_title_rolls_back(conn, feed_id)

    assert conn.in_transaction is False
    assert conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0] == 0
    assert conn.execute("SELECT COUNT(*) FROM skipped_keys").fetchone()[0] == 0


def test_register_after_rollback_still_treated_as_first_run(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    _register_entries_with_unbindable_title_rolls_back(conn, feed_id)

    entries = _dated_entries(13)
    inserted = register_entries(conn, feed_id, entries, NOW)

    assert inserted == 10
    skipped_keys = {
        row[0]
        for row in conn.execute(
            "SELECT key FROM skipped_keys WHERE feed_id = ?", (feed_id,)
        ).fetchall()
    }
    assert skipped_keys == {"key-0", "key-1", "key-2"}


def test_second_run_garbage_and_naive_published_at_stored_as_is(
    conn: sqlite3.Connection,
) -> None:
    feed_id = get_or_create_feed(conn, "https://example.com/feed.xml", None)
    first = _dated_entries(10)
    register_entries(conn, feed_id, first, NOW)

    garbage = Entry(key="garbage2", published_at="garbage")
    naive = Entry(key="naive2", published_at="2026-09-18T00:00:00")
    skipped_before = conn.execute(
        "SELECT COUNT(*) FROM skipped_keys WHERE feed_id = ?", (feed_id,)
    ).fetchone()[0]

    inserted = register_entries(conn, feed_id, [garbage, naive], NOW)

    assert inserted == 2
    skipped_after = conn.execute(
        "SELECT COUNT(*) FROM skipped_keys WHERE feed_id = ?", (feed_id,)
    ).fetchone()[0]
    assert skipped_after == skipped_before
    rows = dict(
        conn.execute(
            "SELECT key, published_at FROM articles WHERE feed_id = ? "
            "AND key IN ('garbage2', 'naive2')",
            (feed_id,),
        ).fetchall()
    )
    assert rows == {"garbage2": "garbage", "naive2": "2026-09-18T00:00:00"}
