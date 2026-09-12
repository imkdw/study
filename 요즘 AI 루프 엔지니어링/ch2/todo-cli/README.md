# todo-cli

`todos.json` 파일에 할 일을 저장하는 간단한 CLI.

## 설치

```bash
uv sync
```

## 명령어

| 명령 | 사용법 | 동작 |
|---|---|---|
| `add` | `uv run todo-cli add "장보기"` | 할 일 추가, 부여된 id 출력 |
| `list` | `uv run todo-cli list` | 전체 목록 출력 |
| `start` | `uv run todo-cli start 1` | 해당 할 일을 진행중으로 변경 |
| `done` | `uv run todo-cli done 1` | 해당 할 일을 완료로 변경 |

### 사용 예시

```bash
$ uv run todo-cli add "장보기"
1번 추가됨: 장보기

$ uv run todo-cli add "보고서 초안 쓰기"
2번 추가됨: 보고서 초안 쓰기

$ uv run todo-cli start 2
2번 진행중으로 변경했습니다

$ uv run todo-cli list
  1  []  장보기
  2  [=] 보고서 초안 쓰기

$ uv run todo-cli done 1
1번 완료했습니다

$ uv run todo-cli list
  1  [O] 장보기
  2  [=] 보고서 초안 쓰기
```

## 상태 표시

| 상태 | 마커 | 색 |
|---|---|---|
| 미완료 (`todo`) | `[]` | 회색 |
| 작업중 (`doing`) | `[=]` | 노랑 |
| 완료 (`done`) | `[O]` | 초록 |

- 색은 터미널에 직접 출력할 때만 붙는다. 파이프/리다이렉트로 넘기면 자동으로 꺼진다.
- `NO_COLOR` 환경변수가 있거나 `--no-color` 를 주면 색을 끈다.

## 옵션

```bash
# 상태로 필터링
uv run todo-cli list --status doing

# 색 끄기
uv run todo-cli list --no-color

# 저장 파일 위치 지정 (기본: 현재 디렉터리의 todos.json)
uv run todo-cli --file ~/notes/todos.json list
TODO_CLI_FILE=~/notes/todos.json uv run todo-cli list
```

경로 우선순위는 `--file` > `TODO_CLI_FILE` > `./todos.json` 순이다.

## 저장 형식

```json
{
  "todos": [
    {
      "id": 1,
      "title": "장보기",
      "status": "done",
      "created_at": "2026-09-12T14:03:21"
    }
  ]
}
```

## 동작 규칙

- 없는 id 를 지정하면 에러 메시지를 내고 종료 코드 1 로 끝난다.
- 이미 완료된 할 일은 다시 `start` 할 수 없다.
- `done` 은 `todo` 상태에서도 바로 완료 처리한다.
- id 는 재사용하지 않는다 (기존 최대 id + 1).
- JSON 이 깨져 있으면 덮어쓰지 않고 에러로 알린다.

## 구조

```
src/todo_cli/
  models.py    # Todo / Status 데이터 모델
  core.py      # 목록 조작 순수 로직 (파일/출력 없음)
  storage.py   # todos.json 읽기/쓰기
  cli.py       # 인자 파싱, 색, 메시지
tests/
  test_core.py
  test_storage.py
  test_cli.py
```

목록 조작 로직(`core.py`)은 파일과 출력에서 분리해 두어 단위 테스트로 검증한다.

## 테스트

```bash
uv run pytest
```
