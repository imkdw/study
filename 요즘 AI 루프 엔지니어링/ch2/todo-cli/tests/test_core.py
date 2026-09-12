import pytest

from todo_cli import core
from todo_cli.models import Status, Todo


def make_todos(*statuses: Status) -> list[Todo]:
    return [
        Todo(id=i, title=f"할 일 {i}", status=status, created_at="2026-01-01T00:00:00")
        for i, status in enumerate(statuses, start=1)
    ]


def test_add_todo_에_id_가_1부터_증가한다():
    todos, first = core.add_todo([], "장보기")
    todos, second = core.add_todo(todos, "청소")

    assert first.id == 1
    assert second.id == 2
    assert [t.title for t in todos] == ["장보기", "청소"]
    assert first.status is Status.TODO


def test_add_todo_는_원본_리스트를_바꾸지_않는다():
    original = make_todos(Status.TODO)
    todos, _ = core.add_todo(original, "새 할 일")

    assert len(original) == 1
    assert len(todos) == 2


def test_add_todo_는_제목_공백을_다듬고_빈_제목을_거부한다():
    _, created = core.add_todo([], "  장보기  ")
    assert created.title == "장보기"

    with pytest.raises(core.TodoError):
        core.add_todo([], "   ")


def test_start_와_done_이_상태를_전이시킨다():
    todos = make_todos(Status.TODO)

    started = core.start_todo(todos, 1)
    assert started[0].status is Status.DOING
    assert todos[0].status is Status.TODO  # 원본 불변

    finished = core.complete_todo(started, 1)
    assert finished[0].status is Status.DONE


def test_done_은_todo_상태에서도_바로_완료된다():
    todos = core.complete_todo(make_todos(Status.TODO), 1)
    assert todos[0].status is Status.DONE


def test_완료된_할_일은_다시_시작할_수_없다():
    todos = make_todos(Status.DONE)

    with pytest.raises(core.InvalidTransitionError):
        core.start_todo(todos, 1)


@pytest.mark.parametrize("action", [core.start_todo, core.complete_todo])
def test_없는_id_는_TodoNotFoundError(action):
    with pytest.raises(core.TodoNotFoundError) as exc:
        action(make_todos(Status.TODO), 99)

    assert exc.value.todo_id == 99


def test_filter_by_status():
    todos = make_todos(Status.TODO, Status.DOING, Status.DONE)

    assert [t.id for t in core.filter_by_status(todos, Status.DOING)] == [2]
    assert len(core.filter_by_status(todos, None)) == 3
    assert core.filter_by_status(todos, Status.DONE)[0].id == 3


@pytest.mark.parametrize(
    ("status", "mark"),
    [(Status.TODO, "[]"), (Status.DOING, "[=]"), (Status.DONE, "[O]")],
)
def test_format_mark(status, mark):
    assert core.format_mark(status) == mark
