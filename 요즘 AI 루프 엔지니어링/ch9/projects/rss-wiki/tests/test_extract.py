from typing import Any

import httpx
import pytest

from rss_wiki.extract import (
    ARTICLE_FETCH_TIMEOUT,
    MIN_BODY_LENGTH,
    SUMMARY_INPUT_LIMIT,
    ArticleFetchError,
    _BLOCK_TAGS,
    choose_body,
    extract_text,
    fetch_article_html,
    html_to_text,
    truncate_for_summary,
)
from rss_wiki.fetch import USER_AGENT

ARTICLE_HTML = """
<html>
<head><title>Test Article</title></head>
<body>
<nav><a href="/">Home</a> <a href="/about">About</a></nav>
<header><h1>Test Article</h1></header>
<article>
<p>This is the first paragraph of the article body with enough real
content to be recognized as the main text block by trafilatura's
extraction heuristics, which look for substantial paragraphs.</p>
<p>This is the second paragraph continuing the discussion with more
detail and further sentences to ensure the extracted text is long and
clearly the main content of the page rather than a short fragment.</p>
</article>
<footer>Copyright 2026 Example Corp. All rights reserved.</footer>
</body>
</html>
"""


def test_extract_text_returns_body_and_excludes_navigation() -> None:
    text = extract_text(ARTICLE_HTML)

    assert text is not None
    assert "first paragraph of the article body" in text
    assert "second paragraph continuing the discussion" in text
    assert "Home" not in text
    assert "About" not in text
    assert "Copyright 2026" not in text


def test_extract_text_empty_string_is_none() -> None:
    assert extract_text("") is None


def test_extract_text_no_body_html_is_none() -> None:
    assert extract_text("<html><body></body></html>") is None


def test_extract_text_strips_result(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "rss_wiki.extract.trafilatura.extract", lambda *a, **k: "  body  \n"
    )
    assert extract_text("<html></html>") == "body"


def test_extract_text_whitespace_only_result_is_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("rss_wiki.extract.trafilatura.extract", lambda *a, **k: "   ")
    assert extract_text("<html></html>") is None


def test_html_to_text_strips_tags_and_unescapes_entities() -> None:
    assert html_to_text("<p>a &amp; b</p><p>c</p>") == "a & b\n\nc"


def test_html_to_text_whitespace_only_is_none() -> None:
    assert html_to_text("   \n\t  ") is None


def test_html_to_text_br_is_newline() -> None:
    assert html_to_text("a<br>b") == "a\nb"


def test_html_to_text_excludes_script_and_style() -> None:
    fragment = "<p>hi</p><script>var x=1;</script><style>p{}</style><p>there</p>"
    assert html_to_text(fragment) == "hi\n\nthere"


def test_html_to_text_collapses_horizontal_whitespace() -> None:
    assert html_to_text("a    \t b") == "a b"


def test_html_to_text_collapses_blank_lines() -> None:
    assert html_to_text("a\n\n\n\nb") == "a\n\nb"


def test_html_to_text_trims_spaces_around_line_breaks() -> None:
    assert html_to_text("<div>  a  </div><div> b </div>") == "a\n\nb"


def test_html_to_text_preserves_trailing_ampersand_text() -> None:
    assert html_to_text("summary: R&D") == "summary: R&D"


def test_html_to_text_preserves_ampersand_after_block_tag() -> None:
    assert html_to_text("<p>x</p>Q&A") == "x\nQ&A"


def test_choose_body_fallback_preserves_ampersand_text() -> None:
    assert choose_body(None, "AT&T, Q&A") == "AT&T, Q&A"


def test_html_to_text_self_closing_br() -> None:
    assert html_to_text("a<br/>b") == "a\nb"


def test_html_to_text_self_closing_hr() -> None:
    assert html_to_text("a<hr/>b") == "a\nb"


def test_html_to_text_list_items() -> None:
    assert html_to_text("<ul><li>a</li><li>b</li></ul>") == "a\n\nb"


def test_html_to_text_heading() -> None:
    assert html_to_text("<h2>t</h2>x") == "t\nx"


def test_html_to_text_uppercase_script_excluded() -> None:
    assert html_to_text("<SCRIPT>x</SCRIPT>ok") == "ok"


def test_html_to_text_table_cells() -> None:
    assert html_to_text("<tr><td>a</td><td>b</td></tr>") == "a\n\nb"


def test_html_to_text_section_tags() -> None:
    assert html_to_text("<section>a</section><section>b</section>") == "a\n\nb"


def test_html_to_text_hr_without_closing_slash() -> None:
    assert html_to_text("a<hr>b") == "a\nb"


def test_html_to_text_definition_list() -> None:
    assert html_to_text("<dt>k</dt><dd>v</dd>") == "k\n\nv"


def test_html_to_text_crlf_blank_lines_collapse() -> None:
    assert html_to_text("a\r\n\r\n\r\nb") == "a\n\nb"


def test_html_to_text_crlf_single_newline() -> None:
    assert html_to_text("a\r\nb") == "a\nb"


def test_html_to_text_lone_cr_single_newline() -> None:
    assert html_to_text("a\rb") == "a\nb"


def test_html_to_text_lone_cr_blank_lines_collapse() -> None:
    assert html_to_text("a\r\r\r\rb") == "a\n\nb"


_EXPECTED_BLOCK_TAGS = frozenset(
    {
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
)


def test_block_tags_matches_expected_snapshot() -> None:
    assert _BLOCK_TAGS == _EXPECTED_BLOCK_TAGS


@pytest.mark.parametrize("tag", sorted(_EXPECTED_BLOCK_TAGS - {"hr"}))
def test_html_to_text_block_tag_boundary(tag: str) -> None:
    assert html_to_text(f"<{tag}>a</{tag}><{tag}>b</{tag}>") == "a\n\nb"


def test_choose_body_prefers_long_extracted_text() -> None:
    extracted = "e" * MIN_BODY_LENGTH
    assert choose_body(extracted, "<p>feed content</p>") == extracted


def test_choose_body_short_extracted_falls_back_to_feed_content() -> None:
    extracted = "short"
    result = choose_body(extracted, "<p>feed content</p>")
    assert result == "feed content"


def test_choose_body_none_extracted_uses_feed_content() -> None:
    result = choose_body(None, "<p>feed content</p>")
    assert result == "feed content"


def test_choose_body_short_extracted_with_no_feed_content_keeps_extracted() -> None:
    extracted = "short"
    assert choose_body(extracted, None) == "short"


def test_choose_body_short_extracted_with_no_feed_content_strips_result() -> None:
    assert choose_body("  short  ", None) == "short"


def test_choose_body_both_none_returns_none() -> None:
    assert choose_body(None, None) is None


def test_choose_body_whitespace_only_extracted_and_no_feed_content_is_none() -> None:
    assert choose_body("   ", None) is None


def test_choose_body_boundary_199_chars_falls_back() -> None:
    extracted = "e" * (MIN_BODY_LENGTH - 1)
    result = choose_body(extracted, "<p>feed content</p>")
    assert result == "feed content"


def test_choose_body_boundary_200_chars_uses_extracted() -> None:
    extracted = "e" * MIN_BODY_LENGTH
    result = choose_body(extracted, "<p>feed content</p>")
    assert result == extracted


def test_choose_body_length_check_uses_stripped_length() -> None:
    extracted = "x" * (MIN_BODY_LENGTH - 1) + " "
    result = choose_body(extracted, "<p>feed</p>")
    assert result == "feed"


def test_truncate_for_summary_truncates_over_limit() -> None:
    text = "a" * (SUMMARY_INPUT_LIMIT + 1)
    result = truncate_for_summary(text)
    assert len(result) == SUMMARY_INPUT_LIMIT


def test_truncate_for_summary_leaves_short_text_unchanged() -> None:
    assert truncate_for_summary("short text") == "short text"


def test_truncate_for_summary_counts_korean_characters() -> None:
    text = "가" * (SUMMARY_INPUT_LIMIT + 5)
    result = truncate_for_summary(text)
    assert len(result) == SUMMARY_INPUT_LIMIT
    assert result == "가" * SUMMARY_INPUT_LIMIT


def test_fetch_article_html_returns_body_text() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>body</html>")

    client = httpx.Client(transport=httpx.MockTransport(handler))

    result = fetch_article_html("https://example.com/a", client=client)

    assert result == "<html>body</html>"
    client.close()


def test_fetch_article_html_raises_on_http_error_status() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, text="not found")

    client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(ArticleFetchError, match="HTTP 404"):
        fetch_article_html("https://example.com/a", client=client)
    client.close()


def test_fetch_article_html_raises_on_transport_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("timed out", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(ArticleFetchError, match="ConnectTimeout") as exc_info:
        fetch_article_html("https://example.com/a", client=client)
    assert isinstance(exc_info.value.__cause__, httpx.ConnectTimeout)
    client.close()


def test_fetch_article_html_wraps_invalid_url_with_default_client() -> None:
    with pytest.raises(ArticleFetchError, match="InvalidURL") as exc_info:
        fetch_article_html("http://[::1")
    assert isinstance(exc_info.value.__cause__, httpx.InvalidURL)


def test_fetch_article_html_does_not_follow_redirects_on_injected_client() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(301, headers={"Location": "https://example.com/b"})

    client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(ArticleFetchError, match="HTTP 301"):
        fetch_article_html("https://example.com/a", client=client)
    client.close()


def test_fetch_article_html_does_not_close_injected_client() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="body")

    client = httpx.Client(transport=httpx.MockTransport(handler))

    fetch_article_html("https://example.com/a", client=client)

    assert client.is_closed is False
    client.close()


def test_fetch_article_html_default_client_config_and_redirect_and_close(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url == httpx.URL("https://example.com/a"):
            return httpx.Response(301, headers={"Location": "final/a"})
        return httpx.Response(200, text="final body")

    original_client = httpx.Client
    created_kwargs: dict[str, Any] = {}
    created_clients: list[httpx.Client] = []

    def client_factory(**kwargs: Any) -> httpx.Client:
        created_kwargs.update(kwargs)
        kwargs["transport"] = httpx.MockTransport(handler)
        client = original_client(**kwargs)
        created_clients.append(client)
        return client

    monkeypatch.setattr("rss_wiki.extract.httpx.Client", client_factory)

    result = fetch_article_html("https://example.com/a")

    assert result == "final body"
    assert created_kwargs["timeout"] == ARTICLE_FETCH_TIMEOUT
    assert len(requests) == 2
    assert requests[1].url == httpx.URL("https://example.com/final/a")
    assert all(request.headers["User-Agent"] == USER_AGENT for request in requests)
    assert len(created_clients) == 1
    assert created_clients[0].is_closed is True
