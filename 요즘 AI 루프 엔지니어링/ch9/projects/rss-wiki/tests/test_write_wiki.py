from __future__ import annotations

import re
import sqlite3
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Iterator

import pytest

from rss_wiki.db import SummarizedArticle, connect
from rss_wiki.pipeline import write_wiki
from rss_wiki.wiki import WikiArticle, write_article_files

CREATED_AT = "2026-09-18T00:13:02+09:00"


@pytest.fixture
def conn(tmp_path: Path) -> Iterator[sqlite3.Connection]:
    connection = connect(tmp_path / "rss-wiki.db")
    try:
        yield connection
    finally:
        connection.close()


def _summarized(
    *,
    id: int,
    feed_id: int = 1,
    feed_name: str | None = "Feed",
    feed_url: str = "https://example.com/feed.xml",
    title: str | None = "Title",
    link: str | None = "https://example.com/a",
    published_at: str | None = "2026-09-17T10:00:00+09:00",
    summary_lines: list[str] | None = None,
    key_points: list[str] | None = None,
    tags: list[str] | None = None,
) -> SummarizedArticle:
    return SummarizedArticle(
        id=id,
        feed_id=feed_id,
        feed_name=feed_name,
        feed_url=feed_url,
        title=title,
        link=link,
        published_at=published_at,
        created_at=CREATED_AT,
        summary_lines=summary_lines if summary_lines is not None else ["s1", "s2"],
        key_points=key_points if key_points is not None else ["k1", "k2"],
        tags=tags if tags is not None else ["ai", "python"],
    )


def test_articles_are_converted_field_by_field_and_return_value_matches_write_result(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    source = [
        _summarized(
            id=1,
            title="첫 글",
            link="https://example.com/1",
            published_at="2026-09-17T10:00:00+09:00",
            summary_lines=["one-a", "one-b"],
            key_points=["one-k1"],
            tags=["ai", "rust"],
        ),
        _summarized(
            id=2,
            title="둘째 글",
            link="https://example.com/2",
            published_at="2026-09-18T10:00:00+09:00",
            summary_lines=["two-a"],
            key_points=["two-k1", "two-k2"],
            tags=["python"],
        ),
    ]
    recorded: dict[str, object] = {}

    def fake_list_articles(_conn: sqlite3.Connection) -> Sequence[SummarizedArticle]:
        return source

    def fake_write(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> dict[int, Path]:
        recorded["articles"] = list(articles)
        return {1: wiki_dir / "a.md", 2: wiki_dir / "b.md", 3: wiki_dir / "c.md"}

    result = write_wiki(
        conn, tmp_path / "wiki", list_articles=fake_list_articles, write=fake_write
    )

    passed = {a.id: a for a in recorded["articles"]}
    assert passed[1].id == 1
    assert passed[1].title == "첫 글"
    assert passed[1].link == "https://example.com/1"
    assert passed[1].feed_name == "Feed"
    assert passed[1].published_at == "2026-09-17T10:00:00+09:00"
    assert passed[1].created_at == CREATED_AT
    assert passed[1].summary_lines == ["one-a", "one-b"]
    assert passed[1].key_points == ["one-k1"]
    assert passed[1].tags == ["ai", "rust"]
    assert passed[2].summary_lines == ["two-a"]
    assert passed[2].key_points == ["two-k1", "two-k2"]
    assert passed[2].tags == ["python"]
    assert result == 3


def test_none_feed_name_is_replaced_with_feed_url(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    recorded: dict[str, object] = {}

    def fake_list_articles(_conn: sqlite3.Connection) -> Sequence[SummarizedArticle]:
        return [
            _summarized(
                id=1, feed_name=None, feed_url="https://example.com/feed.xml"
            )
        ]

    def fake_write(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> dict[int, Path]:
        recorded["articles"] = list(articles)
        return {}

    write_wiki(conn, tmp_path / "wiki", list_articles=fake_list_articles, write=fake_write)

    [article] = recorded["articles"]
    assert article.feed_name == "https://example.com/feed.xml"


def test_empty_feed_name_is_replaced_with_feed_url(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    recorded: dict[str, object] = {}

    def fake_list_articles(_conn: sqlite3.Connection) -> Sequence[SummarizedArticle]:
        return [_summarized(id=1, feed_name="", feed_url="https://example.com/feed.xml")]

    def fake_write(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> dict[int, Path]:
        recorded["articles"] = list(articles)
        return {}

    write_wiki(conn, tmp_path / "wiki", list_articles=fake_list_articles, write=fake_write)

    [article] = recorded["articles"]
    assert article.feed_name == "https://example.com/feed.xml"


def test_empty_article_list_calls_write_once_with_empty_list_and_returns_zero(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    calls: list[Sequence[WikiArticle]] = []

    def fake_list_articles(_conn: sqlite3.Connection) -> Sequence[SummarizedArticle]:
        return []

    def fake_write(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> dict[int, Path]:
        calls.append(articles)
        return {}

    result = write_wiki(
        conn, tmp_path / "wiki", list_articles=fake_list_articles, write=fake_write
    )

    assert len(calls) == 1
    assert list(calls[0]) == []
    assert result == 0


def test_write_receives_the_same_wiki_dir_object_passed_in(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    target = tmp_path / "wiki"
    recorded: dict[str, object] = {}

    def fake_list_articles(_conn: sqlite3.Connection) -> Sequence[SummarizedArticle]:
        return []

    def fake_write(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> dict[int, Path]:
        recorded["wiki_dir"] = wiki_dir
        return {}

    write_wiki(conn, target, list_articles=fake_list_articles, write=fake_write)

    assert recorded["wiki_dir"] is target


def test_integration_with_real_db_and_writer_creates_files_in_feed_folders(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    feed_named = conn.execute(
        "INSERT INTO feeds (url, name) VALUES (?, ?)",
        ("https://a.example.com/feed.xml", "My Feed"),
    )
    feed_named_id = feed_named.lastrowid
    feed_unnamed = conn.execute(
        "INSERT INTO feeds (url, name) VALUES (?, ?)",
        ("https://b.example.com/feed.xml", None),
    )
    feed_unnamed_id = feed_unnamed.lastrowid
    conn.commit()

    article_a = conn.execute(
        "INSERT INTO articles (feed_id, key, title, link, published_at, status, created_at) "
        "VALUES (?, ?, ?, ?, ?, 'summarized', ?)",
        (feed_named_id, "a-1", "글 A", "https://a.example.com/1", "2026-09-17T10:00:00+09:00", CREATED_AT),
    )
    article_a_id = article_a.lastrowid
    article_b = conn.execute(
        "INSERT INTO articles (feed_id, key, title, link, published_at, status, created_at) "
        "VALUES (?, ?, ?, ?, ?, 'summarized', ?)",
        (feed_unnamed_id, "b-1", "글 B", "https://b.example.com/1", "2026-09-18T10:00:00+09:00", CREATED_AT),
    )
    article_b_id = article_b.lastrowid
    conn.commit()

    conn.execute(
        "INSERT INTO summaries (article_id, summary_lines, key_points, created_at) "
        "VALUES (?, ?, ?, ?)",
        (article_a_id, '["요약 A1", "요약 A2"]', '["포인트 A"]', CREATED_AT),
    )
    conn.execute(
        "INSERT INTO summaries (article_id, summary_lines, key_points, created_at) "
        "VALUES (?, ?, ?, ?)",
        (article_b_id, '["요약 B1"]', '["포인트 B"]', CREATED_AT),
    )
    conn.execute("INSERT INTO tags (name) VALUES ('ai')")
    tag_id = conn.execute("SELECT id FROM tags WHERE name = 'ai'").fetchone()[0]
    conn.execute(
        "INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)",
        (article_a_id, tag_id),
    )
    conn.commit()

    wiki_dir = tmp_path / "wiki"
    result = write_wiki(conn, wiki_dir)

    assert result == 2
    named_dir = wiki_dir / "my-feed"
    unnamed_dir = wiki_dir / "https-b-example-com-feed-xml"
    named_files = list(named_dir.glob("*.md"))
    unnamed_files = list(unnamed_dir.glob("*.md"))
    assert len(named_files) == 1
    assert len(unnamed_files) == 1
    named_text = named_files[0].read_text(encoding="utf-8")
    assert "글 A" in named_text
    assert "요약 A1" in named_text
    unnamed_text = unnamed_files[0].read_text(encoding="utf-8")
    assert "글 B" in unnamed_text
    assert "요약 B1" in unnamed_text


def test_order_independence_matches_real_write_article_files(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    same_date = "2026-09-18T00:00:00+09:00"
    articles = [
        _summarized(id=1, title="X", published_at=same_date),
        _summarized(id=2, title="X", published_at=same_date),
        _summarized(id=3, title="다른 글", published_at="2026-09-19T00:00:00+09:00"),
    ]

    def make_list_articles(
        order: Sequence[SummarizedArticle],
    ) -> Callable[[sqlite3.Connection], Sequence[SummarizedArticle]]:
        def _list(_conn: sqlite3.Connection) -> Sequence[SummarizedArticle]:
            return order

        return _list

    ascending_dir = tmp_path / "ascending"
    descending_dir = tmp_path / "descending"

    write_wiki(
        conn,
        ascending_dir,
        list_articles=make_list_articles(articles),
        write=write_article_files,
    )
    write_wiki(
        conn,
        descending_dir,
        list_articles=make_list_articles(list(reversed(articles))),
        write=write_article_files,
    )

    def snapshot(root: Path) -> dict[str, str]:
        return {
            str(path.relative_to(root)): path.read_text(encoding="utf-8")
            for path in root.rglob("*.md")
        }

    ascending_snapshot = snapshot(ascending_dir)
    # T10b: write_wiki가 기본으로 write_tags/write_index_file도 함께 부르므로
    # 글 파일 3개 + 태그 파일 2개(ai/python) + index.md 1개 = 6개다.
    assert len(ascending_snapshot) == 6
    assert ascending_snapshot == snapshot(descending_dir)


# (h)
def test_write_wiki_calls_write_tags_and_write_index_file_once_each(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    recorded: dict[str, object] = {}
    calls: dict[str, int] = {"write": 0, "write_tags": 0, "write_index_file": 0}

    def fake_list_articles(_conn: sqlite3.Connection) -> Sequence[SummarizedArticle]:
        return [_summarized(id=1)]

    def fake_write(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> dict[int, Path]:
        calls["write"] += 1
        recorded["write_articles"] = list(articles)
        return {1: wiki_dir / "a.md"}

    def fake_write_tags(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> dict[str, Path]:
        calls["write_tags"] += 1
        recorded["write_tags_wiki_dir"] = wiki_dir
        recorded["write_tags_articles"] = list(articles)
        return {}

    def fake_write_index_file(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> Path:
        calls["write_index_file"] += 1
        recorded["write_index_wiki_dir"] = wiki_dir
        recorded["write_index_articles"] = list(articles)
        return wiki_dir / "index.md"

    target = tmp_path / "wiki"
    write_wiki(
        conn,
        target,
        list_articles=fake_list_articles,
        write=fake_write,
        write_tags=fake_write_tags,
        write_index_file=fake_write_index_file,
    )

    assert calls == {"write": 1, "write_tags": 1, "write_index_file": 1}
    assert recorded["write_tags_wiki_dir"] is target
    assert recorded["write_index_wiki_dir"] is target
    assert recorded["write_tags_articles"] == recorded["write_articles"]
    assert recorded["write_index_articles"] == recorded["write_articles"]


# (i)
def test_write_wiki_return_value_is_still_write_dict_length(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    def fake_list_articles(_conn: sqlite3.Connection) -> Sequence[SummarizedArticle]:
        return [_summarized(id=1), _summarized(id=2)]

    def fake_write(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> dict[int, Path]:
        return {1: wiki_dir / "a.md", 2: wiki_dir / "b.md"}

    def fake_write_tags(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> dict[str, Path]:
        return {"ai": wiki_dir / "tags" / "ai.md", "python": wiki_dir / "tags" / "python.md", "rust": wiki_dir / "tags" / "rust.md"}

    def fake_write_index_file(
        wiki_dir: Path, articles: Sequence[WikiArticle]
    ) -> Path:
        return wiki_dir / "index.md"

    result = write_wiki(
        conn,
        tmp_path / "wiki",
        list_articles=fake_list_articles,
        write=fake_write,
        write_tags=fake_write_tags,
        write_index_file=fake_write_index_file,
    )

    assert result == 2


# (j)
def test_write_wiki_integration_produces_tags_and_index_with_no_broken_links(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    feed = conn.execute(
        "INSERT INTO feeds (url, name) VALUES (?, ?)",
        ("https://a.example.com/feed.xml", "My Feed"),
    )
    feed_id = feed.lastrowid
    conn.commit()

    article_a = conn.execute(
        "INSERT INTO articles (feed_id, key, title, link, published_at, status, created_at) "
        "VALUES (?, ?, ?, ?, ?, 'summarized', ?)",
        (feed_id, "a-1", "글 A", "https://a.example.com/1", "2026-09-17T10:00:00+09:00", CREATED_AT),
    )
    article_a_id = article_a.lastrowid
    article_b = conn.execute(
        "INSERT INTO articles (feed_id, key, title, link, published_at, status, created_at) "
        "VALUES (?, ?, ?, ?, ?, 'summarized', ?)",
        (feed_id, "a-2", "글 B", "https://a.example.com/2", "2026-09-18T10:00:00+09:00", CREATED_AT),
    )
    article_b_id = article_b.lastrowid
    conn.commit()

    conn.execute(
        "INSERT INTO summaries (article_id, summary_lines, key_points, created_at) "
        "VALUES (?, ?, ?, ?)",
        (article_a_id, '["요약 A1"]', '["포인트 A"]', CREATED_AT),
    )
    conn.execute(
        "INSERT INTO summaries (article_id, summary_lines, key_points, created_at) "
        "VALUES (?, ?, ?, ?)",
        (article_b_id, '["요약 B1"]', '["포인트 B"]', CREATED_AT),
    )
    conn.execute("INSERT INTO tags (name) VALUES ('ai')")
    tag_id = conn.execute("SELECT id FROM tags WHERE name = 'ai'").fetchone()[0]
    conn.execute(
        "INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)",
        (article_a_id, tag_id),
    )
    conn.commit()

    wiki_dir = tmp_path / "wiki"
    result = write_wiki(conn, wiki_dir)

    assert result == 2
    assert list((wiki_dir / "tags").glob("*.md")) != []
    assert (wiki_dir / "index.md").exists()

    index_text = (wiki_dir / "index.md").read_text(encoding="utf-8")
    links = re.findall(r"\]\(([^)]+)\)", index_text)
    assert links
    for link in links:
        assert (wiki_dir / link).resolve().exists()
