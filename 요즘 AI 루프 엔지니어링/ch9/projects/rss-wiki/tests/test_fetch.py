from typing import Any

import httpx
import pytest

from rss_wiki.fetch import (
    FETCH_TIMEOUT,
    USER_AGENT,
    FeedFetchError,
    FeedParseError,
    fetch_feed,
    parse_feed,
)

RSS_NAMESPACES = 'xmlns:content="http://purl.org/rss/1.0/modules/content/"'


def _rss(items: str) -> bytes:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" {RSS_NAMESPACES}>
<channel>
  <title>Test Feed</title>
  {items}
</channel>
</rss>""".encode("utf-8")


def _atom(entries: str) -> bytes:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  {entries}
</feed>""".encode("utf-8")


def test_parse_rss_entry(seoul_tz: None) -> None:
    data = _rss(
        """
        <item>
          <title>First Post</title>
          <link>https://example.com/first</link>
          <guid>urn:uuid:1234</guid>
          <pubDate>Thu, 17 Sep 2026 15:13:02 GMT</pubDate>
          <description>First description</description>
        </item>
        """
    )

    feed = parse_feed(data)

    assert feed.title == "Test Feed"
    assert len(feed.entries) == 1
    entry = feed.entries[0]
    assert entry.key == "urn:uuid:1234"
    assert entry.title == "First Post"
    assert entry.link == "https://example.com/first"
    assert entry.published_at == "2026-09-18T00:13:02+09:00"
    assert entry.content == "First description"


def test_parse_atom_entry(seoul_tz: None) -> None:
    data = _atom(
        """
        <entry>
          <title>Atom Entry</title>
          <id>tag:example.com,2026:1</id>
          <link href="https://example.com/atom-entry"/>
          <updated>2026-09-17T15:13:02Z</updated>
          <content type="html">Atom content body</content>
        </entry>
        """
    )

    feed = parse_feed(data)

    assert feed.title == "Atom Feed"
    assert len(feed.entries) == 1
    entry = feed.entries[0]
    assert entry.key == "tag:example.com,2026:1"
    assert entry.link == "https://example.com/atom-entry"
    assert entry.published_at == "2026-09-18T00:13:02+09:00"
    assert entry.content == "Atom content body"


def test_entry_without_guid_uses_link_as_key() -> None:
    data = _rss(
        """
        <item>
          <title>No Guid</title>
          <link>https://example.com/no-guid</link>
          <description>Body</description>
        </item>
        """
    )

    feed = parse_feed(data)

    assert len(feed.entries) == 1
    assert feed.entries[0].key == "https://example.com/no-guid"


def test_entry_without_guid_and_link_is_excluded() -> None:
    data = _rss(
        """
        <item>
          <title>No Identifier</title>
          <description>Body</description>
        </item>
        <item>
          <title>Kept</title>
          <link>https://example.com/kept</link>
          <description>Body</description>
        </item>
        """
    )

    feed = parse_feed(data)

    assert len(feed.entries) == 1
    assert feed.entries[0].title == "Kept"


def test_entry_without_published_date_is_none() -> None:
    data = _rss(
        """
        <item>
          <title>No Date</title>
          <link>https://example.com/no-date</link>
          <description>Body</description>
        </item>
        """
    )

    feed = parse_feed(data)

    assert feed.entries[0].published_at is None


def test_content_encoded_takes_priority_over_description() -> None:
    data = _rss(
        """
        <item>
          <title>Both</title>
          <link>https://example.com/both</link>
          <description>Short description</description>
          <content:encoded>Full content body</content:encoded>
        </item>
        """
    )

    feed = parse_feed(data)

    assert feed.entries[0].content == "Full content body"


def test_entry_order_is_preserved() -> None:
    data = _rss(
        """
        <item>
          <title>One</title>
          <link>https://example.com/1</link>
        </item>
        <item>
          <title>Two</title>
          <link>https://example.com/2</link>
        </item>
        <item>
          <title>Three</title>
          <link>https://example.com/3</link>
        </item>
        """
    )

    feed = parse_feed(data)

    assert [entry.title for entry in feed.entries] == ["One", "Two", "Three"]


def test_broken_input_raises_feed_parse_error() -> None:
    with pytest.raises(FeedParseError, match="파싱할 수 없습니다") as exc_info:
        parse_feed(b"not xml")
    assert "RSS/Atom 형식이 아닙니다" not in str(exc_info.value)


def test_empty_bytes_raises_feed_parse_error() -> None:
    with pytest.raises(FeedParseError, match="RSS/Atom 형식이 아닙니다"):
        parse_feed(b"")


def test_html_input_raises_feed_parse_error() -> None:
    with pytest.raises(FeedParseError, match="RSS/Atom 형식이 아닙니다"):
        parse_feed(b"<html><body><p>hello</p></body></html>")


def test_feed_with_no_entries_is_not_an_error() -> None:
    data = _rss("")

    feed = parse_feed(data)

    assert feed.entries == []
    assert feed.title == "Test Feed"


def test_truncated_feed_with_one_entry_is_not_an_error() -> None:
    data = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Test Feed</title>
  <item>
    <title>One</title>
    <link>https://example.com/one</link>
  </item>
</channel>""".encode("utf-8")

    feed = parse_feed(data)

    assert len(feed.entries) == 1
    assert feed.entries[0].title == "One"


def test_blank_guid_falls_back_to_link_as_key() -> None:
    data = _rss(
        """
        <item>
          <title>Blank Guid</title>
          <guid>   </guid>
          <link>https://example.com/blank-guid</link>
        </item>
        """
    )

    feed = parse_feed(data)

    assert feed.entries[0].key == "https://example.com/blank-guid"


def test_atom_published_takes_priority_over_updated(seoul_tz: None) -> None:
    data = _atom(
        """
        <entry>
          <title>Both Dates</title>
          <id>tag:example.com,2026:2</id>
          <link href="https://example.com/both-dates"/>
          <published>2026-09-17T15:13:02Z</published>
          <updated>2026-09-17T20:00:00Z</updated>
        </entry>
        """
    )

    feed = parse_feed(data)

    assert feed.entries[0].published_at == "2026-09-18T00:13:02+09:00"


def test_guid_only_entry_has_no_link() -> None:
    data = _rss(
        """
        <item>
          <title>Guid Only</title>
          <guid>urn:uuid:1</guid>
        </item>
        """
    )

    feed = parse_feed(data)

    assert feed.entries[0].key == "urn:uuid:1"
    assert feed.entries[0].link is None


def test_relative_link_absolutized_with_base_url() -> None:
    data = _rss(
        """
        <item>
          <title>Relative</title>
          <link>/posts/1</link>
        </item>
        """
    )

    feed = parse_feed(data, base_url="https://example.com/feed.xml")

    assert feed.entries[0].link == "https://example.com/posts/1"
    assert feed.entries[0].key == "/posts/1"


def test_relative_link_without_base_url_is_none() -> None:
    data = _rss(
        """
        <item>
          <title>Relative</title>
          <link>/posts/1</link>
        </item>
        """
    )

    feed = parse_feed(data)

    assert feed.entries[0].link is None


def test_uppercase_https_scheme_is_accepted() -> None:
    data = _rss(
        """
        <item>
          <title>Upper</title>
          <link>HTTPS://example.com/a</link>
        </item>
        """
    )

    feed = parse_feed(data)

    assert feed.entries[0].link == "HTTPS://example.com/a"


def test_ftp_scheme_link_is_none() -> None:
    data = _rss(
        """
        <item>
          <title>Ftp</title>
          <link>ftp://example.com/a</link>
        </item>
        """
    )

    feed = parse_feed(data)

    assert feed.entries[0].link is None


def test_link_with_surrounding_whitespace_is_stripped() -> None:
    data = _rss(
        """
        <item>
          <title>Whitespace</title>
          <link>  https://example.com/whitespace  </link>
        </item>
        """
    )

    feed = parse_feed(data)

    assert feed.entries[0].link == "https://example.com/whitespace"


def test_fetch_feed_parses_relative_link_against_request_url() -> None:
    data = _rss(
        """
        <item>
          <title>Relative</title>
          <link>/posts/1</link>
        </item>
        """
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=data)

    client = httpx.Client(transport=httpx.MockTransport(handler))

    feed = fetch_feed("https://example.com/feed.xml", client=client)

    assert feed.entries[0].link == "https://example.com/posts/1"
    client.close()


def test_fetch_feed_absolutizes_link_against_final_redirect_url() -> None:
    data = _rss(
        """
        <item>
          <title>Relative</title>
          <link>posts/1</link>
        </item>
        """
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url == httpx.URL("https://example.com/feed.xml"):
            return httpx.Response(
                301, headers={"Location": "https://example.com/final/feed.xml"}
            )
        return httpx.Response(200, content=data)

    client = httpx.Client(
        transport=httpx.MockTransport(handler), follow_redirects=True
    )

    feed = fetch_feed("https://example.com/feed.xml", client=client)

    assert feed.entries[0].link == "https://example.com/final/posts/1"
    client.close()


def test_fetch_feed_raises_on_http_error_status() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, content=b"not found")

    client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(
        FeedFetchError, match=r"HTTP 404.*https://example\.com/feed\.xml"
    ):
        fetch_feed("https://example.com/feed.xml", client=client)
    client.close()


def test_fetch_feed_does_not_close_injected_client() -> None:
    data = _rss(
        """
        <item>
          <title>One</title>
          <link>https://example.com/1</link>
        </item>
        """
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=data)

    client = httpx.Client(transport=httpx.MockTransport(handler))

    fetch_feed("https://example.com/feed.xml", client=client)

    assert client.is_closed is False
    client.close()


def test_fetch_feed_raises_on_transport_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("timed out", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(FeedFetchError, match="ConnectTimeout"):
        fetch_feed("https://example.com/feed.xml", client=client)
    client.close()


def test_fetch_feed_raises_feed_parse_error_on_html_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, content=b"<html><body><p>hello</p></body></html>"
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(FeedParseError, match="RSS/Atom 형식이 아닙니다"):
        fetch_feed("https://example.com/feed.xml", client=client)
    client.close()


def test_fetch_feed_wraps_invalid_url_with_default_client() -> None:
    with pytest.raises(FeedFetchError, match="InvalidURL") as exc_info:
        fetch_feed("http://[::1")

    assert isinstance(exc_info.value.__cause__, httpx.InvalidURL)


def test_fetch_feed_default_client_config_and_redirect_and_close(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    data = _rss(
        """
        <item>
          <title>One</title>
          <link>posts/1</link>
        </item>
        """
    )
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url == httpx.URL("https://example.com/feed.xml"):
            return httpx.Response(301, headers={"Location": "final/feed.xml"})
        return httpx.Response(200, content=data)

    original_client = httpx.Client
    created_kwargs: dict[str, Any] = {}
    created_clients: list[httpx.Client] = []

    def client_factory(**kwargs: Any) -> httpx.Client:
        created_kwargs.update(kwargs)
        kwargs["transport"] = httpx.MockTransport(handler)
        client = original_client(**kwargs)
        created_clients.append(client)
        return client

    monkeypatch.setattr("rss_wiki.fetch.httpx.Client", client_factory)

    feed = fetch_feed("https://example.com/feed.xml")

    assert feed.entries[0].link == "https://example.com/final/posts/1"
    assert created_kwargs["timeout"] == FETCH_TIMEOUT
    assert len(requests) == 2
    assert requests[1].url == httpx.URL("https://example.com/final/feed.xml")
    assert all(request.headers["User-Agent"] == USER_AGENT for request in requests)
    assert len(created_clients) == 1
    assert created_clients[0].is_closed is True
