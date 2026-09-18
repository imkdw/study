from __future__ import annotations

import sqlite3
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path

from rss_wiki.config import FeedConfig
from rss_wiki.db import (
    GIVE_UP_THRESHOLD,
    PendingArticle,
    SummarizedArticle,
    count_given_up_articles,
    get_feed_failures,
    get_or_create_feed,
    list_pending_articles,
    list_summarized_articles,
    list_tag_names,
    record_article_failure,
    record_feed_failure,
    record_feed_success,
    register_entries,
    save_article_body,
    save_summary,
)
from rss_wiki.extract import ArticleFetchError, choose_body, extract_text, fetch_article_html
from rss_wiki.fetch import FeedFetchError, FeedParseError, ParsedFeed, fetch_feed
from rss_wiki.summarize import SummaryError, SummaryResult, check_claude, summarize_body
from rss_wiki.timeutil import now_iso
from rss_wiki.wiki import WikiArticle, write_article_files, write_index, write_tag_pages


@dataclass(frozen=True)
class CollectResult:
    new_articles: int
    failed_feeds: int
    given_up_feeds: int


def collect(
    conn: sqlite3.Connection,
    feeds: Sequence[FeedConfig],
    *,
    fetch: Callable[[str], ParsedFeed] = fetch_feed,
    now: Callable[[], str] = now_iso,
) -> CollectResult:
    """피드 목록을 수집한다.

    포기한 피드(연속 실패가 `GIVE_UP_THRESHOLD` 이상)는 fetch 없이 건너뛰고
    `given_up_feeds`로 센다. `FeedFetchError`/`FeedParseError`/
    `register_entries`의 `sqlite3.Error`만 피드 단위 실패로 다룬다. 실패 기록
    경로 자체(`get_feed_failures`/`get_or_create_feed`/`record_feed_failure`/
    `record_feed_success`)에서 난 `sqlite3.Error`는 DB 장애로 보고 잡지 않고
    실행 전체 실패로 올린다.
    """
    new_articles = 0
    failed_feeds = 0
    given_up_feeds = 0

    for feed in feeds:
        failures = get_feed_failures(conn, feed.url)
        if failures is not None and failures >= GIVE_UP_THRESHOLD:
            given_up_feeds += 1
            continue

        try:
            parsed = fetch(feed.url)
        except (FeedFetchError, FeedParseError) as exc:
            feed_id = get_or_create_feed(conn, feed.url, feed.name)
            record_feed_failure(conn, feed_id, str(exc))
            failed_feeds += 1
            continue

        feed_id = get_or_create_feed(conn, feed.url, feed.name or parsed.title)

        now_value = now()
        try:
            new_count = register_entries(conn, feed_id, parsed.entries, now_value)
        except sqlite3.Error as exc:
            record_feed_failure(conn, feed_id, str(exc))
            failed_feeds += 1
            continue

        record_feed_success(conn, feed_id, now_value)
        new_articles += new_count

    return CollectResult(
        new_articles=new_articles,
        failed_feeds=failed_feeds,
        given_up_feeds=given_up_feeds,
    )


def prepare_body(
    conn: sqlite3.Connection,
    article: PendingArticle,
    *,
    fetch_html: Callable[[str], str] = fetch_article_html,
    extract: Callable[[str, str | None], str | None] = extract_text,
) -> str | None:
    """글 하나의 본문을 준비해 저장한다.

    재시도 시 `article.content`에는 직전 실행이 저장한 본문(평문)이 들어 있고,
    이것이 이번 실행에서 원문 추출이 부족할 때 쓰는 `feed_content`가 된다.
    `html_to_text`가 평문에서 거의 같은 값을 돌려주므로 스키마를 늘리지 않는다.
    """
    fetch_error: ArticleFetchError | None = None
    extracted: str | None = None
    if article.link is not None:
        try:
            html = fetch_html(article.link)
        except ArticleFetchError as exc:
            fetch_error = exc
        else:
            extracted = extract(html, article.link)

    body = choose_body(extracted, article.content)

    if body is not None:
        save_article_body(conn, article.id, body)
        return body

    message = "본문 없음: 원문 추출과 피드 content 모두 비어 있음"
    if fetch_error is not None:
        message = f"{message} (원문 요청 실패: {fetch_error})"
    record_article_failure(conn, article.id, message)
    return None


def summarize_article(
    conn: sqlite3.Connection,
    article: PendingArticle,
    *,
    fetch_html: Callable[[str], str] = fetch_article_html,
    extract: Callable[[str, str | None], str | None] = extract_text,
    summarize: Callable[[str, Sequence[str]], SummaryResult] = summarize_body,
    now: Callable[[], str] = now_iso,
) -> bool:
    """글 하나를 본문 준비 → 요약 → 저장까지 조율한다.

    글 실패 기록(`record_article_failure`)은 `SummaryError`에서만 한다.
    `ClaudeUnavailableError`와 그 밖의 예외(`RuntimeError` 등)는 잡지 않고
    그대로 올려 실행 전체를 멈춘다(PRD 7절: `claude` 자체 실패는 글 실패가 아니다).
    """
    body = prepare_body(conn, article, fetch_html=fetch_html, extract=extract)
    if body is None:
        return False

    tags = list_tag_names(conn)

    try:
        result = summarize(body, tags)
    except SummaryError as exc:
        record_article_failure(conn, article.id, str(exc))
        return False

    save_summary(conn, article.id, result.summary, result.key_points, result.tags, now())
    return True


@dataclass(frozen=True)
class SummarizeResult:
    succeeded: int
    failed: int
    given_up: int


def summarize_pending(
    conn: sqlite3.Connection,
    *,
    max_summaries: int,
    list_articles: Callable[
        [sqlite3.Connection, int], Sequence[PendingArticle]
    ] = list_pending_articles,
    summarize_one: Callable[[sqlite3.Connection, PendingArticle], bool] = summarize_article,
    check: Callable[[], None] = check_claude,
) -> SummarizeResult:
    """실행당 상한 안에서 대기 중인 글을 요약한다.

    `max_summaries`가 0 이하면 조회도 사전 확인도 하지 않고 빈 결과를
    돌려준다(자체 결정: SQLite `LIMIT -1`은 "상한 없음"이라 음수를 그대로
    넘기면 PRD 4.4의 상한이 조용히 사라진다).

    `list_articles`는 이 호출에서 한 번만 부른다(자체 결정: `record_article_failure`가
    3회째에 `given_up`으로 바꾸므로 다음 실행에서 자연히 빠지고, 재조회는 상한
    계산을 두 곳으로 갈라 놓는다).

    글이 하나도 없으면 `check`를 부르지 않는다(자체 결정: 요약할 글이 없는
    실행에서 사전 확인이 짧은 프롬프트 1회를 소모하면 구독 한도를 이유 없이
    쓴다). 글이 1개 이상이면 루프 전에 `check`를 정확히 1회 부르고, 이 호출과
    `summarize_one`이 내는 `ClaudeUnavailableError`/그 밖의 예외는 잡지 않고
    그대로 올린다(PRD 7절: `claude` 자체 실패는 글 실패가 아니다).

    포기 수는 루프 전후 `count_given_up_articles` 차이다(자체 결정: 이번
    실행에서 포기로 넘어간 글 수. `CollectResult.given_up_feeds`가 이미
    실행당 델타이고 PRD 4.6의 출력 네 항목이 모두 "이번 실행" 기준이라
    누적값과 섞으면 읽을 수 없다).
    """
    if max_summaries <= 0:
        return SummarizeResult(0, 0, 0)

    articles = list_articles(conn, max_summaries)
    if not articles:
        return SummarizeResult(0, 0, 0)

    check()

    before = count_given_up_articles(conn)
    succeeded = 0
    failed = 0
    for article in articles:
        if summarize_one(conn, article):
            succeeded += 1
        else:
            failed += 1
    after = count_given_up_articles(conn)

    return SummarizeResult(succeeded=succeeded, failed=failed, given_up=after - before)


def write_wiki(
    conn: sqlite3.Connection,
    wiki_dir: Path,
    *,
    list_articles: Callable[
        [sqlite3.Connection], Sequence[SummarizedArticle]
    ] = list_summarized_articles,
    write: Callable[[Path, Sequence[WikiArticle]], dict[int, Path]] = write_article_files,
    write_tags: Callable[[Path, Sequence[WikiArticle]], dict[str, Path]] = write_tag_pages,
    write_index_file: Callable[[Path, Sequence[WikiArticle]], Path] = write_index,
) -> int:
    """요약이 끝난 글을 읽어 위키 파일로 쓰고 쓴 글 파일 수를 돌려준다.

    글 파일을 쓴 뒤 같은 글 목록으로 주제 페이지(`write_tags`)와 인덱스
    (`write_index_file`)도 함께 재생성한다. 반환값은 글 파일 수 그대로
    둔다(자체 결정: PRD 4.6이 출력하라는 것은 새 글/성공/실패/포기 수이고
    파일 수가 아니며, T9c (a)/(d)의 "반환값 == `write` dict 길이" 계약을
    이유 없이 깨지 않고, 주제 페이지/인덱스는 매 실행 재생성이라 세어도
    정보가 없다).

    `feed_name`이 falsy(`None`/`""`)이면 `feed_url`로 대체한다. `None`만 거르면
    빈 문자열이 그대로 `slugify("")` → `untitled` 폴더로 뭉쳐 서로 다른 피드가
    섞이기 때문이다. `list_articles`가 돌려주는 목록 순서에는 의존하지 않는다
    (이름 배정과 충돌 회피는 `write`가 글 id 기준으로 한다).
    """
    articles = [
        WikiArticle(
            id=article.id,
            title=article.title,
            link=article.link,
            feed_name=article.feed_name or article.feed_url,
            published_at=article.published_at,
            created_at=article.created_at,
            summary_lines=article.summary_lines,
            key_points=article.key_points,
            tags=article.tags,
        )
        for article in list_articles(conn)
    ]
    written = write(wiki_dir, articles)
    write_tags(wiki_dir, articles)
    write_index_file(wiki_dir, articles)
    return len(written)
