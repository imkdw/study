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
uv run main.py --search <keyword>  # 명언 본문에 키워드가 포함된 항목만 출력 (서버를 띄우지 않음)
uv run quote-cli         # [project.scripts] 엔트리포인트 (지금은 Hello 출력만)
uv add <pkg>             # 의존성 추가
uv run pytest -q         # 테스트 실행
```

테스트는 pytest(`tests/`)로 돌린다. 루트 `conftest.py` 는 빈 파일이지만 `import main` 이 되게 하는 역할이라 지우면 안 된다.
린터는 아직 없다. 추가할 때는 `uv add --dev` 로 넣고 이 목록도 갱신한다.

## 구조

두 갈래가 한 저장소에 섞여 있고 서로 연결돼 있지 않다. 수정할 때 어느 쪽인지 먼저 구분한다.

1. **MCP 서버** — 루트 `main.py` 단일 파일. `FastMCP("quote")` 위에 데코레이터로 네 가지를 등록한다.
   - `@mcp.tool()` `get_random_quote` (읽기) / `add_quote` (쓰기)
   - `@mcp.resource("quote://all")` 전체 목록
   - `@mcp.prompt()` `quote_post` — `quote://all` 리소스를 참조하는 프롬프트
   데이터는 같은 폴더의 `quotes.db`(SQLite) 하나뿐이다. 매 호출마다 `load_quotes()` 가 `init_db()` 로 테이블을 보장한 뒤 `id` 오름차순으로 전체를 읽고, `add_quote` 는 한 행만 INSERT 한다. `search_quotes()` 는 파이썬이 아니라 SQL `LIKE` 로 거른다(본문만 검색, 대소문자 무시). 캐시/ORM 계층 없음.
   스키마는 `quotes(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, author TEXT NOT NULL)` 한 테이블뿐이고, `id` 는 밖으로 노출하지 않는다.
   `quotes.json` 은 최초 1회 시드 소스로만 남는다. 테이블이 비어 있고 파일이 있으면 그 내용으로 채우고, 파일이 없으면 조용히 빈 테이블로 둔다. DB 를 다시 시드하려면 `quotes.db` 를 지우고 다시 실행하면 된다.
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
- 명언 데이터는 `quotes.db` 에 쓴다. `quotes.json` 은 시드용 읽기 전용이라 실행 중에 덮어쓰지 않는다.
- JSON 직렬화는 항상 `ensure_ascii=False` 다. `all_quotes` 리소스는 `json.dumps(quotes, ensure_ascii=False, indent=2)` 로 만든다. 한글이 이스케이프되면 잘못 쓴 것이다.
- `quotes.db` 와 그 부산물(`quotes.db-wal` / `quotes.db-shm`)은 `.gitignore` 로 빼둔다. 커밋되는 건 시드인 `quotes.json` 뿐이다.
- 새 MCP 도구를 추가하면 docstring 을 반드시 쓴다. 그 문장이 모델에게 보이는 도구 설명이 된다.
