# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 성격

`요즘 AI 루프 엔지니어링` 책 ch4 예제. 이름은 `quote-cli` 지만 실체는 **MCP 서버 + Claude Code 훅 실습**이다.
CLI 기능은 아직 없고, `src/quote_cli/__init__.py` 의 `main()` 은 `uv init --package` 스캐폴드 그대로다.

상위 `/Users/imkdw/study` 가 git 저장소 루트인 학습용 모노레포. 경로에 공백/한글이 있으니 셸 명령에서 항상 인용부호로 감싼다.

## 명령어

패키지 관리는 uv 전용이다. `pip` / `python -m venv` 를 직접 쓰지 않는다.

```bash
uv sync                  # .venv 동기화
uv run main.py           # MCP 서버를 stdio 로 직접 실행 (.mcp.json 이 쓰는 명령)
uv run mcp dev main.py   # MCP Inspector 로 도구/리소스/프롬프트 수동 점검
uv run quote-cli         # [project.scripts] 엔트리포인트 (지금은 Hello 출력만)
uv add <pkg>             # 의존성 추가
```

테스트 프레임워크와 린터는 아직 없다. 추가할 때는 `uv add --dev` 로 넣고 이 목록도 갱신한다.

## 구조

두 갈래가 한 저장소에 섞여 있고 서로 연결돼 있지 않다. 수정할 때 어느 쪽인지 먼저 구분한다.

1. **MCP 서버** — 루트 `main.py` 단일 파일. `FastMCP("quote")` 위에 데코레이터로 네 가지를 등록한다.
   - `@mcp.tool()` `get_random_quote` (읽기) / `add_quote` (쓰기)
   - `@mcp.resource("quote://all")` 전체 목록
   - `@mcp.prompt()` `quote_post` — `quote://all` 리소스를 참조하는 프롬프트
   데이터는 같은 폴더의 `quotes.json` 하나뿐이고, 매 호출마다 `load_quotes()` 로 전체를 읽고 `add_quote` 는 전체를 다시 쓴다. 캐시/DB 계층 없음.
2. **패키지 스캐폴드** — `src/quote_cli/`. 빌드 백엔드가 `uv_build` 라 패키지는 반드시 이 경로 아래에 둔다.

`main.py` 는 `src/quote_cli` 를 import 하지 않는다. 서버 코드를 패키지 안으로 옮기면 `.mcp.json` 의 `args` 도 같이 고쳐야 한다.

## MCP 등록

`.mcp.json` 이 프로젝트 스코프로 `quote` 서버를 stdio 로 붙인다 (`uv run main.py`).
Claude Code 세션에서는 `mcp__quote__get_random_quote` / `mcp__quote__add_quote` 로 노출된다.
`main.py` 의 도구 시그니처나 docstring 을 바꾸면 세션을 재시작해야 반영된다.

## 훅

`.claude/settings.json` 의 PreToolUse 훅 두 개가 이 챕터의 핵심 실습물이다. 실습 대상이므로 함부로 비활성화하지 않는다.

- `.claude/hooks/block-dangerous.sh` — Bash 도구 매처. `rm -rf` 계열(옵션 순서 변형 포함)을 정규식으로 잡아 `permissionDecision: "deny"` JSON 을 내보내 차단한다.
- `.claude/hooks/audit-mcp.sh` — `mcp__quote__add_quote` 매처. 호출 시각/도구명/입력값을 `.claude/mcp-audit.log` 에 탭 구분으로 append 한다.

두 훅 모두 stdin JSON 을 `jq` 로 파싱하므로 `jq` 가 필수다. 훅을 추가/수정하면 `bash -c '<json> | .claude/hooks/<script>.sh'` 로 단독 실행해 출력 JSON 부터 확인한다.

## 규칙

- Python 3.13 기준(`.python-version`). 최신 문법을 쓰되 하위 호환 분기는 만들지 않는다.
- `quotes.json` 은 `ensure_ascii=False, indent=2` 로 저장한다. 한글이 이스케이프되면 잘못 쓴 것이다.
- 새 MCP 도구를 추가하면 docstring 을 반드시 쓴다. 그 문장이 모델에게 보이는 도구 설명이 된다.
