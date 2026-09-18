from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlsplit

import feedparser
import httpx

from rss_wiki.timeutil import struct_time_to_iso

FETCH_TIMEOUT = 30.0
USER_AGENT = "rss-wiki"


@dataclass(frozen=True)
class FeedEntry:
    key: str
    title: str | None
    link: str | None
    published_at: str | None
    content: str | None


@dataclass(frozen=True)
class ParsedFeed:
    title: str | None
    entries: list[FeedEntry]


class FeedParseError(Exception):
    pass


class FeedFetchError(Exception):
    pass


def _entry_key(entry: Any) -> str | None:
    guid = entry.get("id")
    if isinstance(guid, str):
        guid = guid.strip()
        if guid:
            return guid

    link = entry.get("link")
    if isinstance(link, str):
        link = link.strip()
        if link:
            return link

    return None


def _entry_link(entry: Any, base_url: str | None) -> str | None:
    link = entry.get("link")
    if not isinstance(link, str):
        return None

    link = link.strip()
    if not link:
        return None

    if base_url:
        link = urljoin(base_url, link)

    if urlsplit(link).scheme in {"http", "https"}:
        return link

    return None


def _entry_content(entry: Any) -> str | None:
    content = entry.get("content")
    if content:
        value = content[0].get("value")
        if value:
            return value

    summary = entry.get("summary")
    if summary:
        return summary

    return None


def _entry_published_at(entry: Any) -> str | None:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    return struct_time_to_iso(parsed)


def parse_feed(data: bytes, base_url: str | None = None) -> ParsedFeed:
    parsed = feedparser.parse(data)
    if not parsed.entries and (parsed.bozo or not parsed.get("version")):
        if parsed.bozo:
            raise FeedParseError(f"피드를 파싱할 수 없습니다: {parsed.bozo_exception}")
        raise FeedParseError("피드를 파싱할 수 없습니다: RSS/Atom 형식이 아닙니다")

    entries: list[FeedEntry] = []
    for entry in parsed.entries:
        key = _entry_key(entry)
        if key is None:
            continue

        entries.append(
            FeedEntry(
                key=key,
                title=entry.get("title"),
                link=_entry_link(entry, base_url),
                published_at=_entry_published_at(entry),
                content=_entry_content(entry),
            )
        )

    return ParsedFeed(title=parsed.feed.get("title"), entries=entries)


def fetch_feed(url: str, client: httpx.Client | None = None) -> ParsedFeed:
    owns_client = client is None
    if client is None:
        client = httpx.Client(
            timeout=FETCH_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        )

    try:
        try:
            response = client.get(url)
        except (httpx.HTTPError, httpx.InvalidURL) as exc:
            raise FeedFetchError(
                f"피드 요청 실패: {type(exc).__name__}: {exc} {url}"
            ) from exc

        if not (200 <= response.status_code < 300):
            raise FeedFetchError(f"피드 요청 실패: HTTP {response.status_code} {url}")

        return parse_feed(response.content, base_url=str(response.url))
    finally:
        if owns_client:
            client.close()
