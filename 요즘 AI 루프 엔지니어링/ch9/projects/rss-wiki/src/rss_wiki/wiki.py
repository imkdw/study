"""위키 산출물을 만드는 층. 순수 함수(글 이름/렌더)와 파일 쓰기를 담는다. DB를 모른다."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Mapping, Sequence

_MAX_SLUG_LENGTH = 80
_COLLAPSE_DASHES = re.compile(r"-+")
TAGS_DIRNAME = "tags"
INDEX_FILENAME = "index.md"
INDEX_RECENT_LIMIT = 20


@dataclass(frozen=True)
class WikiArticle:
    id: int
    title: str | None
    link: str | None
    feed_name: str
    published_at: str | None
    created_at: str
    summary_lines: list[str]
    key_points: list[str]
    tags: list[str]


def slugify(text: str) -> str:
    """한글/영문/숫자만 남기고 나머지는 `-`로 바꿔 최대 80자로 만든다."""
    chars = []
    for ch in text:
        if ch.isascii() and ch.isalnum():
            chars.append(ch.lower())
        elif "가" <= ch <= "힣":
            chars.append(ch)
        else:
            chars.append("-")
    collapsed = _COLLAPSE_DASHES.sub("-", "".join(chars)).strip("-")
    trimmed = collapsed[:_MAX_SLUG_LENGTH].strip("-")
    return trimmed or "untitled"


def article_date(article: WikiArticle) -> str:
    """`published_at`이 있으면 그 앞 10자, 없으면 `created_at`의 앞 10자를 쓴다."""
    value = article.published_at or article.created_at
    return value[:10]


def assign_filenames(articles: Sequence[WikiArticle]) -> dict[int, str]:
    """한 피드 폴더 안 글들에 id 오름차순으로 결정적인 파일 이름을 배정한다."""
    result: dict[int, str] = {}
    used: set[str] = set()
    for article in sorted(articles, key=lambda a: a.id):
        base = f"{article_date(article)}-{slugify(article.title or '')}"
        name = f"{base}.md"
        count = 1
        while name in used:
            count += 1
            name = f"{base}-{count}.md"
        used.add(name)
        result[article.id] = name
    return result


def feed_dirname(feed_name: str) -> str:
    """피드 폴더 이름은 피드 이름을 slug로 바꾼 값이다."""
    return slugify(feed_name)


def article_relpaths(articles: Sequence[WikiArticle]) -> dict[int, str]:
    """글 id에서 위키 루트 기준 상대 경로 문자열로의 매핑을 만든다.

    글은 `feed_dirname(article.feed_name)` 기준으로 묶이고, 묶음마다
    `assign_filenames`로 이름이 배정된다(충돌은 같은 폴더 안에서만 본다).
    경로 구분자는 플랫폼과 무관하게 `/`를 쓴다(마크다운 링크에 그대로 들어간다).
    """
    by_dirname: dict[str, list[WikiArticle]] = {}
    for article in articles:
        by_dirname.setdefault(feed_dirname(article.feed_name), []).append(article)

    result: dict[int, str] = {}
    for dirname, group in by_dirname.items():
        names = assign_filenames(group)
        for article in group:
            result[article.id] = f"{dirname}/{names[article.id]}"
    return result


def _sort_moment(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        moment = datetime.fromisoformat(value)
    except ValueError:
        return None
    if moment.tzinfo is None:
        return None
    return moment


def sort_articles(articles: Sequence[WikiArticle]) -> list[WikiArticle]:
    """글을 최신순(새 글이 앞)으로 정렬한다.

    기준 시각은 `published_at`을 파싱한 값이고, 없거나 파싱할 수 없거나
    시간대 정보가 없는(naive) 값이면 `created_at`을 같은 방식으로 쓴다.
    둘 다 쓸 수 없으면 시각 없음으로 보고 맨 뒤에 둔다. 같은 시각끼리와
    시각 없는 것들끼리는 id 오름차순이다. `published_at`에는 `"garbage"`나
    naive 문자열이 저장될 수 있으므로(T4b2 계약) 예외를 밖으로 내지 않는다.
    """

    def sort_key(article: WikiArticle) -> tuple[int, float, int]:
        moment = _sort_moment(article.published_at) or _sort_moment(article.created_at)
        if moment is None:
            return (1, 0.0, article.id)
        return (0, -moment.timestamp(), article.id)

    return sorted(articles, key=sort_key)


def assign_tag_filenames(tags: Sequence[str]) -> dict[str, str]:
    """태그 이름 오름차순으로 `{slug}.md` 파일 이름을 배정한다.

    slug가 겹치면 `assign_filenames`와 같은 방식으로 `-2`/`-3`을 붙인다.
    태그 이름 오름차순으로 순회하므로 같은 태그 집합이면 입력 순서와
    무관하게 같은 결과가 나온다.
    """
    result: dict[str, str] = {}
    used: set[str] = set()
    for tag in sorted(tags):
        base = slugify(tag)
        name = f"{base}.md"
        count = 1
        while name in used:
            count += 1
            name = f"{base}-{count}.md"
        used.add(name)
        result[tag] = name
    return result


def render_tag_page(
    tag: str, articles: Sequence[WikiArticle], relpaths: Mapping[int, str]
) -> str:
    """태그 주제 페이지를 렌더한다.

    주제 페이지는 `tags/` 폴더 안에 있으므로 `relpaths`의 위키 루트 기준
    경로 앞에 `../`를 붙여야 실제 글 파일로 이어진다. `relpaths`에 없는
    글은 우리가 만든 입력이 어긋난 것이므로 `KeyError`로 터뜨린다.
    """
    lines = [f"# 태그: {tag}", ""]
    for article in sort_articles(articles):
        title = article.title if article.title else "(제목 없음)"
        lines.append(f"- [{title}](../{relpaths[article.id]}) — {article_date(article)}")
    lines.append("")
    return "\n".join(lines)


def render_index(
    articles: Sequence[WikiArticle],
    relpaths: Mapping[int, str],
    tag_filenames: Mapping[str, str],
) -> str:
    """루트 `index.md`를 렌더한다.

    피드 이름 오름차순으로 절을 만들고 각 절에는 그 피드 글을 최신순으로
    최대 `INDEX_RECENT_LIMIT`개까지 나열한다. 마지막 `## 태그` 절에는
    `tag_filenames`를 태그 이름 오름차순으로 나열한다. 글이나 태그가
    0개여도 예외 없이 제목과 절을 낸다.
    """
    by_feed: dict[str, list[WikiArticle]] = {}
    for article in articles:
        by_feed.setdefault(article.feed_name, []).append(article)

    lines = ["# RSS Wiki", ""]
    for feed_name in sorted(by_feed):
        lines.append(f"## {feed_name}")
        lines.append("")
        recent = sort_articles(by_feed[feed_name])[:INDEX_RECENT_LIMIT]
        for article in recent:
            title = article.title if article.title else "(제목 없음)"
            lines.append(f"- [{title}]({relpaths[article.id]}) — {article_date(article)}")
        lines.append("")

    lines.append("## 태그")
    lines.append("")
    for tag in sorted(tag_filenames):
        lines.append(f"- [{tag}]({TAGS_DIRNAME}/{tag_filenames[tag]})")
    lines.append("")
    return "\n".join(lines)


def render_article(article: WikiArticle) -> str:
    """글 하나를 frontmatter와 본문을 갖춘 마크다운 문자열로 렌더한다."""
    frontmatter_fields = (
        ("title", article.title),
        ("link", article.link),
        ("feed", article.feed_name),
        ("published_at", article.published_at),
        ("created_at", article.created_at),
        ("tags", article.tags),
    )
    lines = ["---"]
    for key, value in frontmatter_fields:
        lines.append(f"{key}: {json.dumps(value, ensure_ascii=False)}")
    lines.append("---")
    lines.append("")
    lines.append("## 3줄 요약")
    lines.append("")
    lines.extend(f"- {item}" for item in article.summary_lines)
    lines.append("")
    lines.append("## 핵심 포인트")
    lines.append("")
    lines.extend(f"- {item}" for item in article.key_points)
    lines.append("")
    lines.append("## 원문")
    lines.append("")
    lines.append(article.link if article.link else "원문 링크 없음")
    lines.append("")
    return "\n".join(lines)


def _tag_names(articles: Sequence[WikiArticle]) -> list[str]:
    """글들의 태그를 모아 중복 없이 이름 오름차순 목록으로 돌려준다."""
    names: set[str] = set()
    for article in articles:
        names.update(article.tags)
    return sorted(names)


def write_tag_pages(wiki_dir: Path, articles: Sequence[WikiArticle]) -> dict[str, Path]:
    """태그별 주제 페이지를 `wiki_dir / TAGS_DIRNAME` 아래에 쓴다.

    태그가 하나도 없으면 `tags/` 폴더를 만들지 않는다(`write_article_files`가
    빈 목록에서 피드 폴더를 만들지 않는 것과 같은 방향). 기존 파일은
    덮어쓰지만 `tags/` 안의 다른 파일(낡은 주제 페이지 등)은 지우지 않는다
    (자체 결정, PRD 4.1의 "이미 만든 위키 파일은 지우지 않는다"를 따름).
    """
    tags = _tag_names(articles)
    if not tags:
        return {}

    relpaths = article_relpaths(articles)
    names = assign_tag_filenames(tags)
    tags_dir = wiki_dir / TAGS_DIRNAME
    tags_dir.mkdir(parents=True, exist_ok=True)

    result: dict[str, Path] = {}
    for tag in tags:
        tagged = [article for article in articles if tag in article.tags]
        file_path = tags_dir / names[tag]
        file_path.write_text(
            render_tag_page(tag, tagged, relpaths), encoding="utf-8", newline="\n"
        )
        result[tag] = file_path
    return result


def write_index(wiki_dir: Path, articles: Sequence[WikiArticle]) -> Path:
    """루트 `index.md`를 쓴다.

    태그 파일 이름은 `write_tag_pages`와 각자 `assign_tag_filenames`로
    구한다(자체 결정). 같은 태그 집합에서 결정적이므로(T10a (i)) 두 결과는
    전달 경로 없이도 구조적으로 일치한다. 글이 0개여도 파일을 만든다.
    """
    relpaths = article_relpaths(articles)
    tag_filenames = assign_tag_filenames(_tag_names(articles))
    file_path = wiki_dir / INDEX_FILENAME
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(
        render_index(articles, relpaths, tag_filenames), encoding="utf-8", newline="\n"
    )
    return file_path


def write_article_files(
    wiki_dir: Path, articles: Sequence[WikiArticle]
) -> dict[int, Path]:
    """글들을 피드별 폴더에 마크다운 파일로 쓴다.

    글은 `feed_dirname(article.feed_name)` 기준으로 묶이고, 묶음마다
    `assign_filenames`로 이름이 배정된다(충돌은 같은 폴더 안에서만 본다).
    기존 파일은 덮어쓰지만 위키 폴더의 다른 파일은 지우지 않는다.
    반환값은 글 id에서 실제로 쓴 파일 경로로의 매핑이다.
    """
    relpaths = article_relpaths(articles)
    result: dict[int, Path] = {}
    for article in articles:
        file_path = wiki_dir / relpaths[article.id]
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(render_article(article), encoding="utf-8", newline="\n")
        result[article.id] = file_path
    return result
