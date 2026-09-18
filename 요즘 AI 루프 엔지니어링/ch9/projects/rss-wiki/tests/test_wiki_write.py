from __future__ import annotations

from pathlib import Path

from rss_wiki.wiki import WikiArticle, feed_dirname, render_article, write_article_files


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


def test_writes_files_for_same_feed_into_created_subdirectory(tmp_path: Path) -> None:
    wiki_dir = tmp_path / "wiki"
    articles = [
        _make_article(id=1, title="First"),
        _make_article(id=2, title="Second"),
    ]

    result = write_article_files(wiki_dir, articles)

    dirname = feed_dirname("Feed")
    files = sorted((wiki_dir / dirname).iterdir())
    assert len(files) == 2
    for article in articles:
        path = result[article.id]
        assert path.read_text(encoding="utf-8") == render_article(article)


def test_articles_with_different_feed_names_go_to_separate_folders(tmp_path: Path) -> None:
    wiki_dir = tmp_path / "wiki"
    articles = [
        _make_article(id=1, feed_name="Feed A", title="A"),
        _make_article(id=2, feed_name="Feed B", title="B"),
    ]

    write_article_files(wiki_dir, articles)

    assert len(list((wiki_dir / feed_dirname("Feed A")).iterdir())) == 1
    assert len(list((wiki_dir / feed_dirname("Feed B")).iterdir())) == 1


def test_same_date_and_title_articles_both_kept_with_distinct_names(tmp_path: Path) -> None:
    wiki_dir = tmp_path / "wiki"
    articles = [
        _make_article(id=1, title="Same", published_at="2026-09-18T00:00:00+09:00"),
        _make_article(id=2, title="Same", published_at="2026-09-18T00:00:00+09:00"),
    ]

    result = write_article_files(wiki_dir, articles)

    assert result[1] != result[2]
    assert result[1].is_file()
    assert result[2].is_file()


def test_rerun_with_same_input_is_stable(tmp_path: Path) -> None:
    wiki_dir = tmp_path / "wiki"
    articles = [
        _make_article(id=1, title="First"),
        _make_article(id=2, title="Second"),
    ]

    first = write_article_files(wiki_dir, articles)
    dirname = feed_dirname("Feed")
    names_before = sorted(p.name for p in (wiki_dir / dirname).iterdir())
    contents_before = {p.name: p.read_text(encoding="utf-8") for p in (wiki_dir / dirname).iterdir()}

    second = write_article_files(wiki_dir, articles)
    names_after = sorted(p.name for p in (wiki_dir / dirname).iterdir())
    contents_after = {p.name: p.read_text(encoding="utf-8") for p in (wiki_dir / dirname).iterdir()}

    assert names_before == names_after
    assert contents_before == contents_after
    assert {p.name for p in first.values()} == {p.name for p in second.values()}


def test_preexisting_unrelated_file_is_not_deleted(tmp_path: Path) -> None:
    wiki_dir = tmp_path / "wiki"
    dirname = feed_dirname("Feed")
    old_dir = wiki_dir / dirname
    old_dir.mkdir(parents=True)
    old_file = old_dir / "old.md"
    old_file.write_text("keep me", encoding="utf-8")

    write_article_files(wiki_dir, [_make_article(id=1, title="New")])

    assert old_file.is_file()
    assert old_file.read_text(encoding="utf-8") == "keep me"


def test_korean_title_and_feed_name_written_as_utf8_without_crlf(tmp_path: Path) -> None:
    wiki_dir = tmp_path / "wiki"
    article = _make_article(id=1, title="첫 글", feed_name="내 피드")

    result = write_article_files(wiki_dir, [article])

    path = result[1]
    assert path.exists()
    assert "첫 글" in path.read_text(encoding="utf-8")
    assert b"\r" not in path.read_bytes()
