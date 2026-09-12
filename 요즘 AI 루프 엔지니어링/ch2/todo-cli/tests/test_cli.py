import pytest

from todo_cli import cli
from todo_cli.models import Status, Todo


def test_colorize_는_색_끄면_원문_그대로():
    assert cli.colorize("[O] 할 일", Status.DONE, use_color=False) == "[O] 할 일"


@pytest.mark.parametrize(
    ("status", "code"),
    [(Status.TODO, "\033[90m"), (Status.DOING, "\033[33m"), (Status.DONE, "\033[32m")],
)
def test_colorize_는_상태마다_다른_색을_쓴다(status, code):
    result = cli.colorize("본문", status, use_color=True)

    assert result.startswith(code)
    assert result.endswith(cli.RESET)


def test_render_line_은_마커_폭을_맞춘다():
    todos = [
        Todo(1, "장보기", Status.TODO, "2026-01-01T00:00:00"),
        Todo(2, "보고서", Status.DOING, "2026-01-01T00:00:00"),
        Todo(3, "회신", Status.DONE, "2026-01-01T00:00:00"),
    ]
    lines = [cli.render_line(t, use_color=False) for t in todos]

    title_columns = {line.index(t.title) for line, t in zip(lines, todos)}
    assert len(title_columns) == 1  # 제목 시작 위치가 모두 같다
    assert lines[0] == "  1  []  장보기"


def test_no_color_환경변수와_플래그가_색을_끈다(monkeypatch):
    class Tty:
        def isatty(self):
            return True

    monkeypatch.delenv("NO_COLOR", raising=False)
    assert cli.should_use_color(no_color_flag=False, stream=Tty()) is True
    assert cli.should_use_color(no_color_flag=True, stream=Tty()) is False

    monkeypatch.setenv("NO_COLOR", "1")
    assert cli.should_use_color(no_color_flag=False, stream=Tty()) is False


def test_파이프_출력이면_색을_끈다(monkeypatch):
    class NotTty:
        def isatty(self):
            return False

    monkeypatch.delenv("NO_COLOR", raising=False)
    assert cli.should_use_color(no_color_flag=False, stream=NotTty()) is False


def test_명령_흐름_end_to_end(tmp_path, capsys):
    path = tmp_path / "todos.json"
    args = ["--file", str(path)]

    assert cli.run([*args, "add", "장보기"]) == 0
    assert cli.run([*args, "add", "청소"]) == 0
    assert cli.run([*args, "start", "2"]) == 0
    assert cli.run([*args, "done", "1"]) == 0
    capsys.readouterr()

    assert cli.run([*args, "list", "--no-color"]) == 0
    out = capsys.readouterr().out
    assert "[O] 장보기" in out
    assert "[=] 청소" in out


def test_없는_id_는_종료코드_1_과_에러_메시지(tmp_path, capsys):
    path = tmp_path / "todos.json"

    assert cli.run(["--file", str(path), "done", "42"]) == 1
    assert "찾을 수 없습니다" in capsys.readouterr().err


def test_빈_목록_안내문(tmp_path, capsys):
    path = tmp_path / "todos.json"

    assert cli.run(["--file", str(path), "list"]) == 0
    assert "할 일이 없습니다" in capsys.readouterr().out
