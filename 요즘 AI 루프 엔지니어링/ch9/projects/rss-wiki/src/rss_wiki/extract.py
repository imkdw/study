from __future__ import annotations

import re
from html.parser import HTMLParser

import httpx
import trafilatura

from rss_wiki.fetch import USER_AGENT

ARTICLE_FETCH_TIMEOUT = 30.0
MIN_BODY_LENGTH = 200
SUMMARY_INPUT_LIMIT = 20_000


class ArticleFetchError(Exception):
    pass


_BLOCK_TAGS = {
    "p",
    "div",
    "li",
    "ul",
    "ol",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
    "tr",
    "table",
    "td",
    "th",
    "section",
    "article",
    "header",
    "footer",
    "figure",
    "figcaption",
    "hr",
    "dt",
    "dd",
}
_SKIPPED_TAGS = {"script", "style"}


class _TextExtractor(HTMLParser):
    """블록 태그 경계에 줄바꿈을 넣고 script/style 내용을 버리며 태그를 제거한다."""

    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIPPED_TAGS:
            self._skip_depth += 1
        elif tag in _BLOCK_TAGS or tag == "br":
            self._chunks.append("\n")

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if tag == "br" or tag in _BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIPPED_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
        elif tag in _BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            self._chunks.append(data)

    def get_text(self) -> str:
        return "".join(self._chunks)


def fetch_article_html(url: str, client: httpx.Client | None = None) -> str:
    """`url`의 원문 HTML을 받아온다. 2xx가 아니거나 요청이 실패하면 `ArticleFetchError`."""
    owns_client = client is None
    if client is None:
        client = httpx.Client(
            timeout=ARTICLE_FETCH_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        )

    try:
        try:
            response = client.get(url)
        except (httpx.HTTPError, httpx.InvalidURL) as exc:
            raise ArticleFetchError(
                f"원문 요청 실패: {type(exc).__name__}: {exc} {url}"
            ) from exc

        if not (200 <= response.status_code < 300):
            raise ArticleFetchError(f"원문 요청 실패: HTTP {response.status_code} {url}")

        return response.text
    finally:
        if owns_client:
            client.close()


def extract_text(html: str, url: str | None = None) -> str | None:
    """trafilatura로 본문을 뽑아 strip한다. 본문이 없거나 비면 `None`."""
    extracted = trafilatura.extract(html, url=url)
    if extracted is None:
        return None

    extracted = extracted.strip()
    return extracted or None


def html_to_text(fragment: str) -> str | None:
    """HTML 조각을 평문으로 바꾼다. 블록 태그/`br` 경계는 줄바꿈, script/style은 제외."""
    parser = _TextExtractor()
    parser.feed(fragment)
    parser.close()
    text = parser.get_text()

    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    return text or None


def choose_body(extracted: str | None, feed_content: str | None) -> str | None:
    """본문을 고른다: 긴 추출문(strip 후 `MIN_BODY_LENGTH`자 이상, PRD 4.3의 자체 결정
    기준) 우선, 아니면 피드 content를 평문화한 값, 그다음 (strip한) 추출문, 모두 없으면
    `None`(요약 실패 대상)."""
    if extracted is not None and len(extracted.strip()) >= MIN_BODY_LENGTH:
        return extracted

    if feed_content is not None:
        feed_text = html_to_text(feed_content)
        if feed_text:
            return feed_text

    if extracted is not None:
        stripped = extracted.strip()
        if stripped:
            return stripped

    return None


def truncate_for_summary(text: str, limit: int = SUMMARY_INPUT_LIMIT) -> str:
    """요약 입력으로 넘길 앞 `limit`자만 남긴다."""
    return text[:limit]
