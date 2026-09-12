"""todos.json 읽기/쓰기 전담. 목록 조작 로직은 넣지 않는다."""

from __future__ import annotations

import json
import os
from pathlib import Path

from todo_cli.models import Todo

DEFAULT_FILENAME = "todos.json"
PATH_ENV = "TODO_CLI_FILE"


class StorageError(Exception):
    """저장소 파일이 없거나 형식이 깨졌을 때."""


def resolve_path(explicit: str | os.PathLike[str] | None = None) -> Path:
    """사용할 저장 경로. 인자 > 환경변수 > 현재 디렉터리 순."""
    if explicit is not None:
        return Path(explicit)
    if env := os.environ.get(PATH_ENV):
        return Path(env)
    return Path.cwd() / DEFAULT_FILENAME


def load(path: str | os.PathLike[str]) -> list[Todo]:
    """파일이 없으면 빈 목록. 깨져 있으면 StorageError."""
    file = Path(path)
    if not file.exists():
        return []

    try:
        raw = json.loads(file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise StorageError(f"{file} 를 읽을 수 없습니다 (JSON 형식 오류): {exc}") from exc

    if not isinstance(raw, dict) or not isinstance(raw.get("todos"), list):
        raise StorageError(f"{file} 의 형식이 올바르지 않습니다 (todos 배열이 없습니다)")

    try:
        return [Todo.from_dict(item) for item in raw["todos"]]
    except (KeyError, TypeError, ValueError) as exc:
        raise StorageError(f"{file} 안의 항목을 해석할 수 없습니다: {exc}") from exc


def save(path: str | os.PathLike[str], todos: list[Todo]) -> None:
    """원자적으로 저장한다. 쓰기 중 실패해도 기존 파일을 깨뜨리지 않는다."""
    file = Path(path)
    file.parent.mkdir(parents=True, exist_ok=True)

    payload = {"todos": [todo.to_dict() for todo in todos]}
    tmp = file.with_suffix(file.suffix + ".tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp.replace(file)
