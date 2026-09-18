from __future__ import annotations

import re
from pathlib import Path

from rss_wiki.wiki import (
    WikiArticle,
    article_relpaths,
    assign_tag_filenames,
    render_index,
    render_tag_page,
    write_article_files,
    write_index,
    write_tag_pages,
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
        tags=tags if tags is not None else [],
    )


# (a)
def test_write_tag_pages_creates_one_file_per_tag(tmp_path: Path):
    a1 = _make_article(id=1, title="A", tags=["ai"])
    a2 = _make_article(id=2, title="B", tags=["python"])
    articles = [a1, a2]

    result = write_tag_pages(tmp_path, articles)

    assert set(result) == {"ai", "python"}
    ai_path = tmp_path / "tags" / "ai.md"
    python_path = tmp_path / "tags" / "python.md"
    assert ai_path.exists()
    assert python_path.exists()

    relpaths = article_relpaths(articles)
    assert ai_path.read_text(encoding="utf-8") == render_tag_page("ai", [a1], relpaths)
    assert python_path.read_text(encoding="utf-8") == render_tag_page("python", [a2], relpaths)


# (b)
def test_write_tag_pages_article_with_two_tags_appears_on_both_pages(tmp_path: Path):
    a = _make_article(id=1, title="Both", link="https://example.com/both", tags=["ai", "python"])
    result = write_tag_pages(tmp_path, [a])

    ai_text = result["ai"].read_text(encoding="utf-8")
    python_text = result["python"].read_text(encoding="utf-8")
    assert "Both" in ai_text
    assert "Both" in python_text


# (c)
def test_write_tag_pages_slug_collision_gets_distinct_files(tmp_path: Path):
    a1 = _make_article(id=1, title="A", tags=["a+b"])
    a2 = _make_article(id=2, title="B", tags=["a-b"])

    result = write_tag_pages(tmp_path, [a1, a2])

    assert result["a+b"] != result["a-b"]
    assert result["a+b"].exists()
    assert result["a-b"].exists()
    assert result["a+b"].name != result["a-b"].name


# (d)
def test_write_tag_pages_no_tags_returns_empty_dict_and_no_folder(tmp_path: Path):
    articles = [_make_article(id=1, tags=[]), _make_article(id=2, tags=[])]

    result = write_tag_pages(tmp_path, articles)

    assert result == {}
    assert (tmp_path / "tags").exists() is False


# (e)
def test_write_tag_pages_links_resolve_to_real_article_files(tmp_path: Path):
    a1 = _make_article(id=1, title="A", feed_name="My Feed", tags=["ai"])
    a2 = _make_article(id=2, title="B", feed_name="My Feed", tags=["ai"])
    articles = [a1, a2]

    write_article_files(tmp_path, articles)
    result = write_tag_pages(tmp_path, articles)

    text = result["ai"].read_text(encoding="utf-8")
    links = re.findall(r"\]\(\.\./([^)]+)\)", text)
    assert len(links) == 2
    for link in links:
        assert (result["ai"].parent / ".." / link).resolve().exists()


# (f)
def test_write_tag_pages_does_not_delete_other_files_in_tags_dir(tmp_path: Path):
    tags_dir = tmp_path / "tags"
    tags_dir.mkdir(parents=True)
    keep_path = tags_dir / "keep.md"
    keep_path.write_text("keep me", encoding="utf-8")

    write_tag_pages(tmp_path, [_make_article(id=1, tags=["ai"])])

    assert keep_path.exists()
    assert keep_path.read_text(encoding="utf-8") == "keep me"


# (g)
def test_write_index_writes_root_index_matching_render_index(tmp_path: Path):
    a1 = _make_article(id=1, title="A", published_at="2026-09-17T00:00:00+09:00")
    a2 = _make_article(id=2, title="B", published_at="2026-09-18T00:00:00+09:00")
    articles = [a1, a2]

    result = write_index(tmp_path, articles)

    assert result == tmp_path / "index.md"
    expected = render_index(
        articles, article_relpaths(articles), assign_tag_filenames([])
    )
    assert result.read_text(encoding="utf-8") == expected


# (h)
def test_write_index_and_write_tag_pages_agree_on_tag_filenames(tmp_path: Path):
    a1 = _make_article(id=1, title="A", tags=["a+b"])
    a2 = _make_article(id=2, title="B", tags=["a-b"])
    articles = [a1, a2]

    write_tag_pages(tmp_path, articles)
    index_path = write_index(tmp_path, articles)

    index_text = index_path.read_text(encoding="utf-8")
    links = re.findall(r"\]\(tags/([^)]+)\)", index_text)
    assert len(links) == 2
    for link in links:
        assert (tmp_path / "tags" / link).exists()


# (i)
def test_write_index_zero_articles_still_creates_file(tmp_path: Path):
    result = write_index(tmp_path, [])

    assert result == tmp_path / "index.md"
    text = result.read_text(encoding="utf-8")
    assert "# RSS Wiki" in text
    assert "## 태그" in text


# (j)
def test_write_functions_are_order_independent(tmp_path: Path):
    same_date = "2026-09-18T00:00:00+09:00"
    articles = [
        _make_article(id=1, title="Same", published_at=same_date, tags=["ai"]),
        _make_article(id=2, title="Same", published_at=same_date, tags=["python"]),
        _make_article(id=3, title="Other", published_at="2026-09-19T00:00:00+09:00", tags=["ai"]),
    ]

    def snapshot(root: Path) -> dict[str, str]:
        return {
            str(path.relative_to(root)): path.read_text(encoding="utf-8")
            for path in root.rglob("*.md")
        }

    ascending_dir = tmp_path / "ascending"
    descending_dir = tmp_path / "descending"
    ascending_dir.mkdir()
    descending_dir.mkdir()

    write_tag_pages(ascending_dir, articles)
    write_index(ascending_dir, articles)
    write_tag_pages(descending_dir, list(reversed(articles)))
    write_index(descending_dir, list(reversed(articles)))

    ascending_snapshot = snapshot(ascending_dir)
    assert len(ascending_snapshot) == 3
    assert ascending_snapshot == snapshot(descending_dir)


# (k)
def test_write_tag_pages_uses_utf8_and_lf_newlines(tmp_path: Path):
    a = _make_article(id=1, title="한글 제목", tags=["한국어"])

    result = write_tag_pages(tmp_path, [a])

    path = result["한국어"]
    text = path.read_text(encoding="utf-8")
    assert "한국어" in text
    raw = path.read_bytes()
    assert b"\r\n" not in raw


# (l)
def test_write_tag_pages_links_point_to_correct_article_on_filename_collision(
    tmp_path: Path,
):
    a1 = _make_article(
        id=1,
        title="x",
        feed_name="My Feed",
        published_at="2026-09-18T00:00:00+09:00",
        tags=["ai"],
    )
    a2 = _make_article(
        id=2,
        title="x",
        feed_name="My Feed",
        published_at="2026-09-18T00:00:00+09:00",
        tags=["python"],
    )
    articles = [a1, a2]

    write_article_files(tmp_path, articles)
    result = write_tag_pages(tmp_path, articles)

    ai_lines = result["ai"].read_text(encoding="utf-8").splitlines()
    python_lines = result["python"].read_text(encoding="utf-8").splitlines()
    assert "- [x](../my-feed/2026-09-18-x.md) — 2026-09-18" in ai_lines
    assert "- [x](../my-feed/2026-09-18-x-2.md) — 2026-09-18" in python_lines
    assert (tmp_path / "my-feed" / "2026-09-18-x.md").exists()
    assert (tmp_path / "my-feed" / "2026-09-18-x-2.md").exists()


# (m)
def test_write_tag_pages_shared_tag_does_not_get_dash_two_filename(tmp_path: Path):
    a1 = _make_article(id=1, title="A", tags=["ai"])
    a2 = _make_article(id=2, title="B", tags=["ai"])
    articles = [a1, a2]

    result = write_tag_pages(tmp_path, articles)

    assert result["ai"].name == "ai.md"
    assert (tmp_path / "tags" / "ai.md").exists() is True
    assert (tmp_path / "tags" / "ai-2.md").exists() is False
    assert sorted(p.name for p in (tmp_path / "tags").iterdir()) == ["ai.md"]

    lines = result["ai"].read_text(encoding="utf-8").splitlines()
    list_lines = [line for line in lines if line.startswith("- [")]
    assert len(list_lines) == 2
