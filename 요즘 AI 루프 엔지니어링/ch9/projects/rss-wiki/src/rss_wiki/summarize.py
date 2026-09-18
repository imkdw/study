from __future__ import annotations

import json
import re
import shutil
import subprocess
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from rss_wiki.extract import truncate_for_summary

_EXISTING_TAGS_EMPTY = "(없음)"

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\n?(.*?)\n?```$", re.DOTALL)

CLAUDE_COMMAND = "claude"
CLAUDE_TIMEOUT = 180.0
PREFLIGHT_TIMEOUT = 60.0


@dataclass(frozen=True)
class SummaryResult:
    summary: list[str]
    key_points: list[str]
    tags: list[str]


class SummaryError(Exception):
    """글 하나의 요약 실패로 취급하는 예외의 공통 상위 클래스."""


class SummaryFormatError(SummaryError):
    """`claude` 출력이 기대한 JSON 형식을 따르지 않을 때."""


class SummaryCallError(SummaryError):
    """`claude` 프로세스 실행/타임아웃/종료 코드 오류."""


class ClaudeUnavailableError(Exception):
    """`claude` 명령이 없거나 로그인되지 않아 사전 확인에 실패했을 때.

    `SummaryError`를 상속하지 않는다: 글 하나의 실패가 아니라 요약 단계
    시작 전체를 막는 오류이므로 글 실패 횟수를 올리지 않는다(PRD 7절).
    """


def normalize_tag(tag: str) -> str:
    """태그를 strip → 소문자화 → 내부 공백을 `-` 하나로 정규화한다."""
    return re.sub(r"\s+", "-", tag.strip().lower())


def build_prompt(body: str, existing_tags: Sequence[str]) -> str:
    """요약 프롬프트를 만든다. 본문은 20,000자로 잘라 넣는다."""
    tags_str = ", ".join(existing_tags) if existing_tags else _EXISTING_TAGS_EMPTY
    truncated = truncate_for_summary(body)
    return (
        "다음 글을 한국어로 요약하라. 원문의 언어와 무관하게 한국어로 작성한다.\n"
        "JSON 객체 하나만 출력하라. 다른 텍스트는 출력하지 않는다.\n"
        "키는 다음 세 개다: summary(문자열 정확히 3개), key_points(문자열 목록), "
        "tags(문자열 목록).\n"
        f"기존 태그 목록: {tags_str}\n"
        "위 목록에 있는 태그를 우선 재사용하고, 필요하면 새 태그도 허용한다.\n\n"
        "본문:\n"
        f"{truncated}"
    )


def _require_string_list(
    value: object, field: str, *, exact: int | None = None, min_len: int = 0
) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise SummaryFormatError(f"{field} 필드가 문자열 목록이 아니다")
    if exact is not None and len(value) != exact:
        raise SummaryFormatError(f"{field} 필드는 문자열 정확히 {exact}개여야 한다")
    if len(value) < min_len:
        raise SummaryFormatError(f"{field} 필드가 비어 있다")
    cleaned = [item.strip() for item in value]
    if any(not item for item in cleaned):
        raise SummaryFormatError(f"{field} 필드에 빈 문자열이 있다")
    return cleaned


def parse_summary_output(text: str) -> SummaryResult:
    """`claude` 출력 텍스트를 검증해 `SummaryResult`로 만든다.

    자체 결정: 모델이 붙이는 ```json 코드 펜스를 흔한 형태로 보고 허용한다.
    태그가 정규화 후 모두 비면 0개도 허용한다(자체 결정).
    """
    stripped = text.strip()
    fence_match = _CODE_FENCE_RE.match(stripped)
    if fence_match:
        stripped = fence_match.group(1).strip()

    try:
        data = json.loads(stripped)
    except json.JSONDecodeError as exc:
        raise SummaryFormatError(f"JSON 파싱 실패: {exc}") from exc

    if not isinstance(data, dict):
        raise SummaryFormatError("최상위 값이 JSON 객체가 아니다")

    summary = _require_string_list(data.get("summary"), "summary", exact=3)
    key_points = _require_string_list(data.get("key_points"), "key_points", min_len=1)

    raw_tags = data.get("tags")
    if not isinstance(raw_tags, list) or not all(isinstance(item, str) for item in raw_tags):
        raise SummaryFormatError("tags 필드가 문자열 목록이 아니다")

    tags: list[str] = []
    for raw_tag in raw_tags:
        normalized = normalize_tag(raw_tag)
        if normalized and normalized not in tags:
            tags.append(normalized)

    return SummaryResult(summary=summary, key_points=key_points, tags=tags)


def call_claude(
    prompt: str,
    *,
    run: Callable[..., subprocess.CompletedProcess[str]] | None = None,
    timeout: float = CLAUDE_TIMEOUT,
) -> str:
    """`claude -p`를 서브프로세스로 호출해 stdout을 반환한다.

    프롬프트는 argv가 아니라 stdin으로 넘긴다(자체 결정: 20,000자 본문을
    안전하게 전달하기 위해). `run`이 없으면 호출 시점에 `subprocess.run`을
    참조한다(monkeypatch가 먹히도록). `text=True`의 출력 디코딩 실패
    (`UnicodeDecodeError`)도 `SummaryCallError`로 감싼다(자체 결정: 글 하나의
    실패로 취급해 실행 전체를 멈추지 않기 위해).
    """
    if run is None:
        run = subprocess.run
    try:
        result = run(
            [CLAUDE_COMMAND, "-p"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise SummaryCallError(f"claude 호출 타임아웃: {timeout:g}초") from exc
    except (FileNotFoundError, OSError) as exc:
        raise SummaryCallError(f"claude 실행 실패: {exc}") from exc
    except UnicodeDecodeError as exc:
        raise SummaryCallError(f"claude 출력 디코딩 실패: {exc}") from exc

    if result.returncode != 0:
        raise SummaryCallError(
            f"claude 종료 코드 {result.returncode}: {result.stderr[:500]}"
        )
    return result.stdout


def summarize_body(
    body: str,
    existing_tags: Sequence[str],
    *,
    run: Callable[..., subprocess.CompletedProcess[str]] | None = None,
) -> SummaryResult:
    """본문을 요약해 `SummaryResult`로 만든다. 프롬프트 생성 → 호출 → 검증 순서."""
    prompt = build_prompt(body, existing_tags)
    output = call_claude(prompt, run=run)
    return parse_summary_output(output)


def check_claude(
    *,
    run: Callable[..., subprocess.CompletedProcess[str]] | None = None,
    which: Callable[[str], str | None] | None = None,
) -> None:
    """`claude` 설치/로그인 여부를 확인한다.

    자체 결정: 로그인 여부를 확인할 안정적인 CLI 하위 명령을 가정하지 않고,
    짧은 프롬프트 한 번을 실제로 호출해 확인한다. 응답 내용은 검사하지
    않는다. 실행당 1회, 요약할 글이 있을 때만 부르는 것은 T11 몫이다.
    """
    if which is None:
        which = shutil.which
    if which(CLAUDE_COMMAND) is None:
        raise ClaudeUnavailableError(
            "claude 명령을 찾을 수 없습니다. Claude Code를 설치하세요"
        )
    try:
        call_claude("OK라고만 답하라.", run=run, timeout=PREFLIGHT_TIMEOUT)
    except SummaryCallError as exc:
        raise ClaudeUnavailableError(
            f"claude 사전 확인 실패(로그인 여부를 확인하세요): {exc}"
        ) from exc
