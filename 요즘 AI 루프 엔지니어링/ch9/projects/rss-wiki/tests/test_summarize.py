import json
import subprocess

import pytest

from rss_wiki.summarize import (
    ClaudeUnavailableError,
    SummaryCallError,
    SummaryError,
    SummaryFormatError,
    SummaryResult,
    build_prompt,
    call_claude,
    check_claude,
    normalize_tag,
    parse_summary_output,
    summarize_body,
)

VALID_PAYLOAD = {
    "summary": ["첫 줄", "둘째 줄", "셋째 줄"],
    "key_points": ["포인트 하나"],
    "tags": ["Python", "rust"],
}
VALID_RESULT = SummaryResult(
    summary=["첫 줄", "둘째 줄", "셋째 줄"],
    key_points=["포인트 하나"],
    tags=["python", "rust"],
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  Machine Learning ", "machine-learning"),
        ("a \t b", "a-b"),
        ("a\xa0b", "a-b"),
        ("Python", "python"),
    ],
)
def test_normalize_tag(raw: str, expected: str) -> None:
    assert normalize_tag(raw) == expected


def test_build_prompt_includes_existing_tags() -> None:
    prompt = build_prompt("본문 내용", ["python", "rust"])
    assert "python, rust" in prompt


def test_build_prompt_empty_tags_shows_placeholder() -> None:
    prompt = build_prompt("본문 내용", [])
    assert "(없음)" in prompt


def test_build_prompt_mentions_korean_and_keys() -> None:
    prompt = build_prompt("본문 내용", [])
    assert "한국어" in prompt
    assert "summary" in prompt
    assert "key_points" in prompt
    assert "tags" in prompt


def test_build_prompt_truncates_body_to_20000_chars() -> None:
    prompt = build_prompt("가" * 25000, [])
    assert prompt.count("가") == 20000


def test_parse_summary_output_plain_json() -> None:
    result = parse_summary_output(json.dumps(VALID_PAYLOAD))
    assert result == VALID_RESULT


def test_parse_summary_output_json_fence() -> None:
    text = f"```json\n{json.dumps(VALID_PAYLOAD)}\n```"
    result = parse_summary_output(text)
    assert result == VALID_RESULT


def test_parse_summary_output_plain_fence() -> None:
    text = f"```\n{json.dumps(VALID_PAYLOAD)}\n```"
    result = parse_summary_output(text)
    assert result == VALID_RESULT


def test_parse_summary_output_surrounding_whitespace() -> None:
    text = f"\n\n  {json.dumps(VALID_PAYLOAD)}  \n\n"
    result = parse_summary_output(text)
    assert result == VALID_RESULT


def test_parse_summary_output_dedupes_and_normalizes_tags() -> None:
    payload = dict(VALID_PAYLOAD, tags=["Machine Learning", "machine-learning", " "])
    result = parse_summary_output(json.dumps(payload))
    assert result.tags == ["machine-learning"]


def test_parse_summary_output_unknown_keys_ignored() -> None:
    payload = dict(VALID_PAYLOAD, unknown="ignored")
    result = parse_summary_output(json.dumps(payload))
    assert result == VALID_RESULT


def test_parse_summary_output_not_json_raises_with_json_cause() -> None:
    with pytest.raises(SummaryFormatError, match="JSON") as exc_info:
        parse_summary_output("not json at all")
    assert isinstance(exc_info.value.__cause__, json.JSONDecodeError)


def test_parse_summary_output_top_level_list_raises() -> None:
    with pytest.raises(SummaryFormatError, match="최상위"):
        parse_summary_output(json.dumps([1, 2, 3]))


def test_parse_summary_output_summary_missing_raises() -> None:
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "summary"}
    with pytest.raises(SummaryFormatError, match="summary"):
        parse_summary_output(json.dumps(payload))


def test_parse_summary_output_summary_two_items_raises() -> None:
    payload = dict(VALID_PAYLOAD, summary=["첫 줄", "둘째 줄"])
    with pytest.raises(SummaryFormatError, match="summary.*3"):
        parse_summary_output(json.dumps(payload))


def test_parse_summary_output_summary_four_items_raises() -> None:
    payload = dict(VALID_PAYLOAD, summary=["첫", "둘", "셋", "넷"])
    with pytest.raises(SummaryFormatError, match="summary.*3"):
        parse_summary_output(json.dumps(payload))


def test_parse_summary_output_summary_blank_string_raises() -> None:
    payload = dict(VALID_PAYLOAD, summary=["첫 줄", "", "셋째 줄"])
    with pytest.raises(SummaryFormatError, match="summary"):
        parse_summary_output(json.dumps(payload))


def test_parse_summary_output_summary_number_raises() -> None:
    payload = dict(VALID_PAYLOAD, summary=["첫 줄", 2, "셋째 줄"])
    with pytest.raises(SummaryFormatError, match="summary"):
        parse_summary_output(json.dumps(payload))


def test_parse_summary_output_key_points_empty_list_raises() -> None:
    payload = dict(VALID_PAYLOAD, key_points=[])
    with pytest.raises(SummaryFormatError, match="key_points"):
        parse_summary_output(json.dumps(payload))


def test_parse_summary_output_key_points_string_raises() -> None:
    payload = dict(VALID_PAYLOAD, key_points="포인트 하나")
    with pytest.raises(SummaryFormatError, match="key_points"):
        parse_summary_output(json.dumps(payload))


def test_parse_summary_output_tags_missing_raises() -> None:
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "tags"}
    with pytest.raises(SummaryFormatError, match="tags"):
        parse_summary_output(json.dumps(payload))


def test_parse_summary_output_tags_number_raises() -> None:
    payload = dict(VALID_PAYLOAD, tags=["python", 1])
    with pytest.raises(SummaryFormatError, match="tags"):
        parse_summary_output(json.dumps(payload))


def test_parse_summary_output_strips_summary_and_key_points() -> None:
    payload = dict(
        VALID_PAYLOAD,
        summary=["  첫 줄 ", "둘째 줄", " 셋째 줄"],
        key_points=[" 포인트 "],
    )
    result = parse_summary_output(json.dumps(payload))
    assert result.summary == ["첫 줄", "둘째 줄", "셋째 줄"]
    assert result.key_points == ["포인트"]


@pytest.mark.parametrize("key_points", [["", "x"], ["   ", "x"]])
def test_parse_summary_output_key_points_blank_item_raises(key_points: list[str]) -> None:
    payload = dict(VALID_PAYLOAD, key_points=key_points)
    with pytest.raises(SummaryFormatError, match="key_points"):
        parse_summary_output(json.dumps(payload))


def test_parse_summary_output_summary_blank_after_strip_raises() -> None:
    payload = dict(VALID_PAYLOAD, summary=["   ", "b", "c"])
    with pytest.raises(SummaryFormatError, match="summary"):
        parse_summary_output(json.dumps(payload))


def test_build_prompt_mentions_reuse_and_new_tags() -> None:
    prompt = build_prompt("본문 내용", ["python"])
    assert "재사용" in prompt
    assert "새 태그" in prompt


def _completed(args: list[str], returncode: int = 0, stdout: str = "", stderr: str = ""):
    return subprocess.CompletedProcess(args, returncode, stdout=stdout, stderr=stderr)


def test_call_claude_with_injected_run_returns_stdout() -> None:
    calls: list[tuple[list[str], dict]] = []

    def fake_run(args, **kwargs):
        calls.append((args, kwargs))
        return _completed(args, 0, stdout="out")

    result = call_claude("p", run=fake_run)

    assert result == "out"
    args, kwargs = calls[0]
    assert args == ["claude", "-p"]
    assert kwargs["input"] == "p"
    assert kwargs["timeout"] == 180.0
    assert kwargs["capture_output"] is True
    assert kwargs["text"] is True
    assert kwargs["check"] is False


def test_call_claude_default_run_uses_subprocess_run(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[list[str]] = []

    def fake_run(args, **kwargs):
        calls.append(args)
        return _completed(args, 0, stdout="out")

    monkeypatch.setattr("rss_wiki.summarize.subprocess.run", fake_run)

    result = call_claude("p")

    assert result == "out"
    assert len(calls) == 1


def test_call_claude_does_not_pass_model_flag() -> None:
    calls: list[list[str]] = []

    def fake_run(args, **kwargs):
        calls.append(args)
        return _completed(args, 0, stdout="out")

    call_claude("p", run=fake_run)

    assert "--model" not in calls[0]


def test_call_claude_nonzero_exit_raises_with_stderr() -> None:
    def fake_run(args, **kwargs):
        return _completed(args, 1, stderr="not logged in")

    with pytest.raises(SummaryCallError, match="종료 코드 1") as exc_info:
        call_claude("p", run=fake_run)
    assert "not logged in" in str(exc_info.value)


def test_call_claude_truncates_stderr_to_500_chars() -> None:
    def fake_run(args, **kwargs):
        return _completed(args, 1, stderr="x" * 1000)

    with pytest.raises(SummaryCallError) as exc_info:
        call_claude("p", run=fake_run)
    assert "x" * 501 not in str(exc_info.value)
    assert "x" * 500 in str(exc_info.value)


def test_call_claude_timeout_raises() -> None:
    def fake_run(args, **kwargs):
        raise subprocess.TimeoutExpired(cmd=args, timeout=kwargs["timeout"])

    with pytest.raises(SummaryCallError, match="타임아웃") as exc_info:
        call_claude("p", run=fake_run)
    assert isinstance(exc_info.value.__cause__, subprocess.TimeoutExpired)
    assert "180초" in str(exc_info.value)
    assert "180.0" not in str(exc_info.value)


def test_call_claude_file_not_found_raises() -> None:
    def fake_run(args, **kwargs):
        raise FileNotFoundError("no such file")

    with pytest.raises(SummaryCallError, match="실행 실패") as exc_info:
        call_claude("p", run=fake_run)
    assert isinstance(exc_info.value.__cause__, FileNotFoundError)


def test_call_claude_permission_error_raises() -> None:
    def fake_run(args, **kwargs):
        raise PermissionError("denied")

    with pytest.raises(SummaryCallError, match="실행 실패") as exc_info:
        call_claude("p", run=fake_run)
    assert isinstance(exc_info.value.__cause__, PermissionError)


def test_call_claude_unicode_decode_error_raises() -> None:
    def fake_run(args, **kwargs):
        raise UnicodeDecodeError("utf-8", b"\xff", 0, 1, "invalid start byte")

    with pytest.raises(SummaryCallError, match="디코딩 실패") as exc_info:
        call_claude("p", run=fake_run)
    assert isinstance(exc_info.value.__cause__, UnicodeDecodeError)
    assert isinstance(exc_info.value, SummaryError)


def test_summarize_body_returns_summary_result_with_existing_tags_in_input() -> None:
    captured: dict = {}

    def fake_run(args, **kwargs):
        captured["input"] = kwargs["input"]
        return _completed(args, 0, stdout=json.dumps(VALID_PAYLOAD))

    result = summarize_body("본문", ["python"], run=fake_run)

    assert result == VALID_RESULT
    assert "python" in captured["input"]


def test_summarize_body_invalid_json_raises_summary_error() -> None:
    def fake_run(args, **kwargs):
        return _completed(args, 0, stdout="not json")

    with pytest.raises(SummaryFormatError) as exc_info:
        summarize_body("본문", [], run=fake_run)
    assert isinstance(exc_info.value, SummaryError)


def test_summary_call_error_is_summary_error_not_claude_unavailable() -> None:
    assert issubclass(SummaryCallError, SummaryError)
    assert not issubclass(SummaryCallError, ClaudeUnavailableError)


def test_check_claude_missing_command_raises_without_calling_run() -> None:
    calls: list[list[str]] = []

    def fake_run(args, **kwargs):
        calls.append(args)
        return _completed(args, 0, stdout="OK")

    with pytest.raises(ClaudeUnavailableError, match="찾을 수 없습니다"):
        check_claude(run=fake_run, which=lambda cmd: None)
    assert calls == []


def test_check_claude_call_failure_raises_claude_unavailable() -> None:
    captured: dict = {}

    def fake_run(args, **kwargs):
        captured["timeout"] = kwargs["timeout"]
        return _completed(args, 1, stderr="not logged in")

    with pytest.raises(ClaudeUnavailableError, match="사전 확인 실패") as exc_info:
        check_claude(run=fake_run, which=lambda cmd: "/usr/local/bin/claude")

    assert isinstance(exc_info.value.__cause__, SummaryCallError)
    assert captured["timeout"] == 60.0


def test_check_claude_success_raises_nothing() -> None:
    def fake_run(args, **kwargs):
        return _completed(args, 0, stdout="OK")

    check_claude(run=fake_run, which=lambda cmd: "/usr/local/bin/claude")


def test_check_claude_default_which_missing_raises_without_calling_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[list[str]] = []

    def fake_run(args, **kwargs):
        calls.append(args)
        return _completed(args, 0, stdout="OK")

    monkeypatch.setattr("rss_wiki.summarize.shutil.which", lambda cmd: None)

    with pytest.raises(ClaudeUnavailableError, match="찾을 수 없습니다"):
        check_claude(run=fake_run)
    assert calls == []


def test_check_claude_default_which_found_calls_run(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[list[str]] = []

    def fake_run(args, **kwargs):
        calls.append(args)
        return _completed(args, 0, stdout="OK")

    monkeypatch.setattr("rss_wiki.summarize.shutil.which", lambda cmd: "/usr/local/bin/claude")

    check_claude(run=fake_run)

    assert len(calls) == 1


def test_check_claude_passes_command_name_to_which() -> None:
    which_calls: list[str] = []

    def fake_which(cmd: str) -> str | None:
        which_calls.append(cmd)
        return "/usr/local/bin/claude"

    def fake_run(args, **kwargs):
        return _completed(args, 0, stdout="OK")

    check_claude(run=fake_run, which=fake_which)

    assert which_calls == ["claude"]
