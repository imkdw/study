import json

import pytest

from todo_cli import core, storage
from todo_cli.models import Status, Todo


def test_파일이_없으면_빈_목록(tmp_path):
    assert storage.load(tmp_path / "todos.json") == []


def test_save_후_load_하면_같은_목록(tmp_path):
    path = tmp_path / "todos.json"
    todos, _ = core.add_todo([], "장보기")
    todos, _ = core.add_todo(todos, "청소")
    todos = core.start_todo(todos, 2)

    storage.save(path, todos)

    assert storage.load(path) == todos


def test_한글_제목이_그대로_저장된다(tmp_path):
    path = tmp_path / "todos.json"
    storage.save(path, [Todo(1, "장보기", Status.TODO, "2026-01-01T00:00:00")])

    raw = json.loads(path.read_text(encoding="utf-8"))
    assert raw["todos"][0]["title"] == "장보기"


def test_깨진_json_은_StorageError(tmp_path):
    path = tmp_path / "todos.json"
    path.write_text("{not json", encoding="utf-8")

    with pytest.raises(storage.StorageError):
        storage.load(path)


def test_todos_키가_없으면_StorageError(tmp_path):
    path = tmp_path / "todos.json"
    path.write_text('{"items": []}', encoding="utf-8")

    with pytest.raises(storage.StorageError):
        storage.load(path)


def test_resolve_path_우선순위(tmp_path, monkeypatch):
    monkeypatch.setenv(storage.PATH_ENV, str(tmp_path / "from-env.json"))

    assert storage.resolve_path("explicit.json").name == "explicit.json"
    assert storage.resolve_path().name == "from-env.json"

    monkeypatch.delenv(storage.PATH_ENV)
    monkeypatch.chdir(tmp_path)
    assert storage.resolve_path() == tmp_path / storage.DEFAULT_FILENAME
