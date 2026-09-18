from __future__ import annotations

import pytest

from rss_wiki.wiki import (
    INDEX_RECENT_LIMIT,
    TAGS_DIRNAME,
    WikiArticle,
    article_relpaths,
    assign_tag_filenames,
    render_index,
    render_tag_page,
    sort_articles,
)


def _make_article(
    *,
    id: int,
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
        summary_lines=summary_lines if summary_lines is not None else ["s1"],
        key_points=key_points if key_points is not None else ["p1"],
        tags=tags if tags is not None else ["tag1"],
    )


# (a)
def test_article_relpaths_groups_by_feed_folder():
    a1 = _make_article(id=1, title="a", feed_name="My Feed")
    a2 = _make_article(id=2, title="b", feed_name="Other Feed")
    assert article_relpaths([a1, a2]) == {
        1: "my-feed/2026-09-18-a.md",
        2: "other-feed/2026-09-18-b.md",
    }


# (b)
def test_article_relpaths_collision_suffix_is_order_independent():
    a1 = _make_article(id=1, title="Same")
    a2 = _make_article(id=2, title="Same")
    forward = article_relpaths([a1, a2])
    reverse = article_relpaths([a2, a1])
    assert forward[1] != forward[2]
    assert forward == reverse


# (c)
def test_sort_articles_orders_by_published_at_descending():
    a1 = _make_article(id=1, published_at="2026-09-17T00:00:00+09:00")
    a2 = _make_article(id=2, published_at="2026-09-19T00:00:00+09:00")
    a3 = _make_article(id=3, published_at="2026-09-18T00:00:00+09:00")
    result = sort_articles([a1, a2, a3])
    assert [a.id for a in result] == [2, 3, 1]


# (d)
def test_sort_articles_falls_back_to_created_at_when_published_at_is_none():
    a1 = _make_article(
        id=1, published_at="2026-09-19T00:00:00+09:00", created_at="2026-09-19T00:00:00+09:00"
    )
    a2 = _make_article(
        id=2, published_at=None, created_at="2026-09-18T00:00:00+09:00"
    )
    a3 = _make_article(
        id=3, published_at="2026-09-17T00:00:00+09:00", created_at="2026-09-17T00:00:00+09:00"
    )
    result = sort_articles([a1, a2, a3])
    assert [a.id for a in result] == [1, 2, 3]


# (e)
def test_sort_articles_does_not_raise_on_garbage_or_naive_published_at():
    garbage = _make_article(
        id=1, published_at="garbage", created_at="2026-09-19T00:00:00+09:00"
    )
    naive = _make_article(
        id=2, published_at="2026-09-18T00:00:00", created_at="2026-09-18T00:00:00+09:00"
    )
    normal = _make_article(id=3, published_at="2026-09-17T00:00:00+09:00")
    result = sort_articles([garbage, naive, normal])
    assert [a.id for a in result] == [1, 2, 3]


# (f)
def test_sort_articles_unparseable_published_at_and_created_at_go_last_by_id():
    a1 = _make_article(id=2, published_at="garbage", created_at="also garbage")
    a2 = _make_article(id=1, published_at="garbage", created_at="also garbage")
    normal = _make_article(id=3, published_at="2026-09-17T00:00:00+09:00")
    result = sort_articles([a1, a2, normal])
    assert [a.id for a in result] == [3, 1, 2]


# (g)
def test_sort_articles_compares_absolute_time_not_string():
    a1 = _make_article(id=2, published_at="2026-09-18T09:00:00+09:00")
    a2 = _make_article(id=1, published_at="2026-09-18T00:00:00+00:00")
    result = sort_articles([a1, a2])
    assert [a.id for a in result] == [1, 2]


# (h)
def test_assign_tag_filenames_simple():
    assert assign_tag_filenames(["python", "ai", "rust"]) == {
        "ai": "ai.md",
        "python": "python.md",
        "rust": "rust.md",
    }


# (i)
def test_assign_tag_filenames_collision_suffix_is_order_independent():
    forward = assign_tag_filenames(["a+b", "a-b"])
    reverse = assign_tag_filenames(["a-b", "a+b"])
    assert len(set(forward.values())) == 2
    assert forward == reverse


# (j)
def test_render_tag_page_two_articles():
    a1 = _make_article(id=1, title="old", feed_name="My Feed", published_at="2026-09-17T00:00:00+09:00")
    a2 = _make_article(id=2, title="new", feed_name="My Feed", published_at="2026-09-18T00:00:00+09:00")
    relpaths = article_relpaths([a1, a2])
    result = render_tag_page("python", [a1, a2], relpaths)
    lines = result.splitlines()
    assert lines[0] == "# 태그: python"
    assert lines[2].startswith("- [new](../my-feed/")
    assert lines[3].startswith("- [old](../my-feed/")
    assert result.endswith("\n")


# (k)
def test_render_tag_page_none_title_shows_placeholder():
    article = _make_article(id=1, title=None, feed_name="My Feed")
    relpaths = article_relpaths([article])
    result = render_tag_page("python", [article], relpaths)
    assert "(제목 없음)" in result
    assert f"](../{relpaths[1]})" in result


# (l)
def test_render_index_feed_sections_and_tags():
    a1 = _make_article(id=1, title="A1", feed_name="b feed", published_at="2026-09-17T00:00:00+09:00")
    a2 = _make_article(id=2, title="A2", feed_name="a feed", published_at="2026-09-18T00:00:00+09:00")
    articles = [a1, a2]
    relpaths = article_relpaths(articles)
    tag_filenames = {"python": "python.md", "ai": "ai.md"}
    result = render_index(articles, relpaths, tag_filenames)

    a_index = result.index("## a feed")
    b_index = result.index("## b feed")
    assert a_index < b_index

    a_section = result[a_index:b_index]
    assert "A2" in a_section
    assert "A1" not in a_section

    tags_index = result.index("## 태그")
    tags_section = result[tags_index:]
    ai_index = tags_section.index(f"{TAGS_DIRNAME}/ai.md")
    python_index = tags_section.index(f"{TAGS_DIRNAME}/python.md")
    assert ai_index < python_index

    assert [line for line in result.splitlines() if line.startswith("## ")][-1] == "## 태그"


# (m)
def test_render_index_caps_feed_section_at_recent_limit():
    articles = [
        _make_article(
            id=i, title=f"t{i}", published_at=f"2026-09-{i:02d}T00:00:00+09:00"
        )
        for i in range(1, 22)
    ]
    relpaths = article_relpaths(articles)
    result = render_index(articles, relpaths, {})
    lines = [line for line in result.splitlines() if line.startswith("- [")]
    assert len(lines) == 20
    assert not any(line.startswith("- [t1]") for line in lines)
    assert INDEX_RECENT_LIMIT == 20


# (n)
def test_render_index_no_articles_or_tags():
    result = render_index([], {}, {})
    assert "# RSS Wiki" in result
    assert "## 태그" in result
    assert result.endswith("\n")


# (o)
def test_render_tag_page_full_literal_output():
    a = _make_article(
        id=1, title="new", feed_name="My Feed", published_at="2026-09-18T00:00:00+09:00"
    )
    result = render_tag_page("python", [a], article_relpaths([a]))
    assert result == "# 태그: python\n\n- [new](../my-feed/2026-09-18-new.md) — 2026-09-18\n"


# (p)
def test_render_index_full_literal_output():
    a = _make_article(
        id=1, title="new", feed_name="My Feed", published_at="2026-09-18T00:00:00+09:00"
    )
    result = render_index([a], article_relpaths([a]), {"ai": "ai.md"})
    assert result == (
        "# RSS Wiki\n\n## My Feed\n\n- [new](my-feed/2026-09-18-new.md) — 2026-09-18"
        "\n\n## 태그\n\n- [ai](tags/ai.md)\n"
    )


# (q)
def test_render_index_none_title_shows_placeholder_full_line():
    a = _make_article(
        id=1, title=None, feed_name="My Feed", published_at="2026-09-18T00:00:00+09:00"
    )
    result = render_index([a], article_relpaths([a]), {})
    lines = [line for line in result.splitlines() if line.startswith("- [")]
    assert lines == ["- [(제목 없음)](my-feed/2026-09-18-untitled.md) — 2026-09-18"]


# (r)
def test_render_tag_page_missing_relpath_raises_key_error():
    a = _make_article(id=7, tags=["python"])
    with pytest.raises(KeyError, match=r"7"):
        render_tag_page("python", [a], {})


# (s)
def test_render_index_missing_relpath_raises_key_error():
    a = _make_article(id=7)
    with pytest.raises(KeyError, match=r"7"):
        render_index([a], {}, {})
