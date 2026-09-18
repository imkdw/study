from __future__ import annotations

import yaml

from rss_wiki.wiki import (
    WikiArticle,
    article_date,
    assign_filenames,
    feed_dirname,
    render_article,
    slugify,
)


def _make_article(
    *,
    id: int = 1,
    title: str | None = "Title",
    link: str | None = "https://example.com",
    feed_name: str = "Feed",
    published_at: str | None = "2026-09-18T00:00:00+09:00",
    created_at: str = "2026-09-18T00:00:00+09:00",
    summary_lines: list[str] | None = None,
    key_points: list[str] | None = None,
    tags: list[str] | None = None,
) -> WikiArticle:
    return WikiArticle(
        id=id,
        title=title,
        link=link,
        feed_name=feed_name,
        published_at=published_at,
        created_at=created_at,
        summary_lines=summary_lines if summary_lines is not None else ["s1", "s2", "s3"],
        key_points=key_points if key_points is not None else ["p1"],
        tags=tags if tags is not None else ["tag1"],
    )


def _parse_frontmatter(markdown: str) -> tuple[dict, str]:
    _, frontmatter_text, body = markdown.split("---\n", 2)
    return yaml.safe_load(frontmatter_text), body


def test_slugify_korean_english_numbers_and_symbols():
    assert slugify("파이썬 3.13 Release!") == "파이썬-3-13-release"


def test_slugify_collapses_and_strips_dashes():
    assert slugify("--  a  b --") == "a-b"


def test_slugify_truncates_to_80_chars():
    result = slugify("a" * 100)
    assert len(result) == 80
    assert not result.endswith("-")


def test_slugify_empty_result_falls_back_to_untitled():
    assert slugify("!!!") == "untitled"


def test_article_date_prefers_published_at_then_created_at():
    published = _make_article(
        published_at="2026-09-18T00:13:02+09:00",
        created_at="2026-01-01T00:00:00+09:00",
    )
    assert article_date(published) == "2026-09-18"

    no_published = _make_article(published_at=None, created_at="2026-09-19T10:00:00+09:00")
    assert article_date(no_published) == "2026-09-19"


def test_assign_filenames_single_article():
    article = _make_article(id=1, title="Hello", published_at="2026-09-18T00:00:00+09:00")
    assert assign_filenames([article]) == {1: "2026-09-18-hello.md"}


def test_assign_filenames_collision_suffix_is_id_order_independent():
    a1 = _make_article(id=1, title="X", published_at="2026-09-18T00:00:00+09:00")
    a2 = _make_article(id=2, title="X", published_at="2026-09-18T00:00:00+09:00")
    a3 = _make_article(id=3, title="X", published_at="2026-09-18T00:00:00+09:00")
    expected = {
        1: "2026-09-18-x.md",
        2: "2026-09-18-x-2.md",
        3: "2026-09-18-x-3.md",
    }
    assert assign_filenames([a3, a1, a2]) == expected
    assert assign_filenames([a1, a2, a3]) == expected


def test_assign_filenames_no_suffix_when_dates_differ():
    a1 = _make_article(id=1, title="X", published_at="2026-09-18T00:00:00+09:00")
    a2 = _make_article(id=2, title="X", published_at="2026-09-19T00:00:00+09:00")
    result = assign_filenames([a1, a2])
    assert result == {1: "2026-09-18-x.md", 2: "2026-09-19-x.md"}


def test_assign_filenames_avoids_collision_with_slug_that_looks_like_suffix():
    a1 = _make_article(id=1, title="X", published_at="2026-09-18T00:00:00+09:00")
    a2 = _make_article(id=2, title="X", published_at="2026-09-18T00:00:00+09:00")
    a3 = _make_article(id=3, title="X 2", published_at="2026-09-18T00:00:00+09:00")
    expected = {
        1: "2026-09-18-x.md",
        2: "2026-09-18-x-2.md",
        3: "2026-09-18-x-2-2.md",
    }
    result_forward = assign_filenames([a1, a2, a3])
    assert result_forward == expected
    assert len(set(result_forward.values())) == 3

    result_reverse = assign_filenames([a3, a2, a1])
    assert result_reverse == expected
    assert len(set(result_reverse.values())) == 3


def test_render_article_frontmatter_and_body_roundtrip():
    article = _make_article(
        title="Title",
        link="https://example.com/a",
        feed_name="Feed",
        published_at="2026-09-18T00:00:00+09:00",
        created_at="2026-09-18T01:00:00+09:00",
        summary_lines=["one", "two", "three"],
        key_points=["p1", "p2"],
        tags=["a", "b"],
    )
    markdown = render_article(article)
    frontmatter, body = _parse_frontmatter(markdown)
    assert frontmatter == {
        "title": "Title",
        "link": "https://example.com/a",
        "feed": "Feed",
        "published_at": "2026-09-18T00:00:00+09:00",
        "created_at": "2026-09-18T01:00:00+09:00",
        "tags": ["a", "b"],
    }
    assert body.count("- one") == 1
    assert body.count("- two") == 1
    assert body.count("- three") == 1
    assert body.count("- p1") == 1
    assert body.count("- p2") == 1
    assert "https://example.com/a" in body

    frontmatter_text = markdown.split("---\n", 2)[1]
    keys = [line.split(":", 1)[0] for line in frontmatter_text.splitlines()]
    assert keys == ["title", "link", "feed", "published_at", "created_at", "tags"]

    assert markdown.endswith("\n")
    assert markdown.count("## 3줄 요약") == 1
    assert markdown.count("## 핵심 포인트") == 1
    assert markdown.count("## 원문") == 1


def test_render_article_title_with_quotes_and_colon():
    title = '그는 "예: 아니오"라고 했다'
    article = _make_article(title=title)
    markdown = render_article(article)
    frontmatter, _ = _parse_frontmatter(markdown)
    assert frontmatter["title"] == title


def test_render_article_without_link_tags_or_key_points():
    article = _make_article(link=None, tags=[], key_points=[])
    markdown = render_article(article)
    frontmatter, body = _parse_frontmatter(markdown)
    assert frontmatter["link"] is None
    assert frontmatter["tags"] == []
    assert "원문 링크 없음" in body


def test_feed_dirname_slugifies_feed_name():
    assert feed_dirname("Simon Willison's Weblog") == "simon-willison-s-weblog"


def test_render_article_section_order_and_content_mapping():
    article = _make_article(
        summary_lines=["s1", "s2", "s3"],
        key_points=["k1", "k2"],
    )
    markdown = render_article(article)
    sections = markdown.split("## ")
    titles = [section.splitlines()[0] for section in sections[1:]]
    assert titles == ["3줄 요약", "핵심 포인트", "원문"]

    summary_block, key_points_block = sections[1], sections[2]
    for line in ("s1", "s2", "s3"):
        assert line in summary_block
        assert line not in key_points_block
    for line in ("k1", "k2"):
        assert line in key_points_block
        assert line not in summary_block
