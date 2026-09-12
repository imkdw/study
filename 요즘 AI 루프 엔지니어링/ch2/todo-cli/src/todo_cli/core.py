"""목록 조작 순수 로직. 파일 접근과 출력은 하지 않는다.

모든 함수는 입력 리스트를 변형하지 않고 새 리스트를 돌려준다.
"""

from __future__ import annotations

from datetime import datetime

from todo_cli.models import Status, Todo

STATUS_MARKS: dict[Status, str] = {
    Status.TODO: "[]",
    Status.DOING: "[=]",
    Status.DONE: "[O]",
}

MARK_WIDTH = 3


class TodoError(Exception):
    """CLI 가 사용자 메시지로 바꿔 보여주는 도메인 예외."""


class TodoNotFoundError(TodoError):
    def __init__(self, todo_id: int) -> None:
        super().__init__(f"{todo_id}번 할 일을 찾을 수 없습니다")
        self.todo_id = todo_id


class InvalidTransitionError(TodoError):
    def __init__(self, todo_id: int, current: Status) -> None:
        super().__init__(f"{todo_id}번은 이미 완료된 할 일입니다")
        self.todo_id = todo_id
        self.current = current


def format_mark(status: Status) -> str:
    """상태 마커를 돌려준다. 색은 붙이지 않는다 (출력 계층 담당)."""
    return STATUS_MARKS[status]


def next_id(todos: list[Todo]) -> int:
    return max((todo.id for todo in todos), default=0) + 1


def find_todo(todos: list[Todo], todo_id: int) -> Todo | None:
    return next((todo for todo in todos if todo.id == todo_id), None)


def add_todo(
    todos: list[Todo],
    title: str,
    *,
    created_at: str | None = None,
) -> tuple[list[Todo], Todo]:
    """새 할 일을 추가하고 (새 목록, 추가된 항목) 을 돌려준다."""
    cleaned = title.strip()
    if not cleaned:
        raise TodoError("할 일 제목이 비어 있습니다")

    todo = Todo(
        id=next_id(todos),
        title=cleaned,
        status=Status.TODO,
        created_at=created_at or datetime.now().isoformat(timespec="seconds"),
    )
    return [*todos, todo], todo


def _replace_status(todos: list[Todo], todo_id: int, status: Status) -> list[Todo]:
    if find_todo(todos, todo_id) is None:
        raise TodoNotFoundError(todo_id)
    return [todo.with_status(status) if todo.id == todo_id else todo for todo in todos]


def start_todo(todos: list[Todo], todo_id: int) -> list[Todo]:
    target = find_todo(todos, todo_id)
    if target is None:
        raise TodoNotFoundError(todo_id)
    if target.status is Status.DONE:
        raise InvalidTransitionError(todo_id, target.status)
    return _replace_status(todos, todo_id, Status.DOING)


def complete_todo(todos: list[Todo], todo_id: int) -> list[Todo]:
    return _replace_status(todos, todo_id, Status.DONE)


def filter_by_status(todos: list[Todo], status: Status | None = None) -> list[Todo]:
    if status is None:
        return list(todos)
    return [todo for todo in todos if todo.status is status]
