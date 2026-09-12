# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 성격

`요즘 AI 루프 엔지니어링` 책 ch2 예제용 todo CLI. 현재는 `uv init --package` 로 만든 스캐폴드 상태이며
`src/todo_cli/__init__.py` 의 `main()` 이 문자열 하나만 출력한다. 기능/명령어/저장소 계층은 아직 없으므로
새 구조는 자유롭게 설계해도 된다.

상위 `/Users/imkdw/study` 가 git 저장소 루트이고, 책별 폴더가 그 아래 나란히 있는 학습용 모노레포다.
이 프로젝트만 커밋할 때도 경로에 공백/한글이 있으니 항상 인용부호로 감싼다.

## 명령어

패키지 관리는 uv 전용이다. `pip` / `python -m venv` 를 직접 쓰지 않는다.

```bash
uv sync                      # .venv 동기화 (dev 그룹 포함)
uv run todo-cli              # CLI 실행 ([project.scripts] 엔트리포인트)
uv run python -m todo_cli    # 모듈 실행은 __main__.py 를 추가한 뒤에만 동작
uv run pytest                # 전체 테스트
uv run pytest tests/test_x.py::test_y   # 단일 테스트
uv add <pkg>                 # 런타임 의존성 추가
uv add --dev <pkg>           # 개발 의존성 추가
```

## 구조 규칙

- 빌드 백엔드가 `uv_build` 이므로 패키지는 반드시 `src/todo_cli/` 아래에 둔다. 이 경로를 벗어나면 설치/스크립트 실행이 깨진다.
- `pyproject.toml` 의 `todo-cli = "todo_cli:main"` 이 유일한 진입점이다. 진입 함수를 옮기면 이 항목도 같이 고친다.
- Python 3.13 기준(`.python-version`). 최신 문법을 쓰되 하위 호환 분기는 만들지 않는다.
- 린터/포매터 설정은 아직 없다. 도구를 추가할 때는 `uv add --dev` 로 넣고 이 문서의 명령어 목록도 갱신한다.

## 공통
- 패키지 관리와 실행은 pip 대신 uv로 합니다
- 기능을 추가하면 `uv run pytest`를 꼭 통과해야합니다
- CLI 입출력과 순수 로직(목록 조작)은 파일을 나눠야합니다
