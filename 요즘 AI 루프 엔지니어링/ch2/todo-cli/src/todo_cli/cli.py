"""입출력 계층. 인자 파싱 / 색 / 메시지만 담당하고 목록 로직은 core 에 맡긴다."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from todo_cli import core, storage
from todo_cli.models import Status, Todo

RESET = "\033[0m"
STATUS_COLORS: dict[Status, str] = {
    Status.TODO: "\033[90m",   # 회색
    Status.DOING: "\033[33m",  # 노랑
    Status.DONE: "\033[32m",   # 초록
}


def colorize(text: str, status: Status, *, use_color: bool) -> str:
    if not use_color:
        return text
    return f"{STATUS_COLORS[status]}{text}{RESET}"


def should_use_color(*, no_color_flag: bool, stream=None) -> bool:
    stream = stream or sys.stdout
    if no_color_flag or os.environ.get("NO_COLOR"):
        return False
    return bool(getattr(stream, "isatty", lambda: False)())


def render_line(todo: Todo, *, use_color: bool) -> str:
    mark = core.format_mark(todo.status).ljust(core.MARK_WIDTH)
    body = f"{mark} {todo.title}"
    return f"{todo.id:>3}  {colorize(body, todo.status, use_color=use_color)}"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="todo-cli", description="todos.json 기반 할 일 관리")
    parser.add_argument("--file", help=f"저장 파일 경로 (기본: ./{storage.DEFAULT_FILENAME})")

    sub = parser.add_subparsers(dest="command", required=True)

    add = sub.add_parser("add", help="할 일 추가")
    add.add_argument("title", help="할 일 제목")

    listing = sub.add_parser("list", help="할 일 목록 출력")
    listing.add_argument("--status", choices=[s.value for s in Status], help="상태로 필터링")
    listing.add_argument("--no-color", action="store_true", help="색 출력 끄기")

    start = sub.add_parser("start", help="할 일을 진행중으로 변경")
    start.add_argument("id", type=int)

    done = sub.add_parser("done", help="할 일을 완료로 변경")
    done.add_argument("id", type=int)

    return parser


def _cmd_add(args: argparse.Namespace, path: Path) -> int:
    todos = storage.load(path)
    todos, created = core.add_todo(todos, args.title)
    storage.save(path, todos)
    print(f"{created.id}번 추가됨: {created.title}")
    return 0


def _cmd_list(args: argparse.Namespace, path: Path) -> int:
    todos = storage.load(path)
    status = Status(args.status) if args.status else None
    rows = core.filter_by_status(todos, status)

    if not rows:
        print("할 일이 없습니다. `todo-cli add \"제목\"` 으로 추가하세요.")
        return 0

    use_color = should_use_color(no_color_flag=args.no_color)
    for todo in rows:
        print(render_line(todo, use_color=use_color))
    return 0


def _cmd_start(args: argparse.Namespace, path: Path) -> int:
    todos = core.start_todo(storage.load(path), args.id)
    storage.save(path, todos)
    print(f"{args.id}번 진행중으로 변경했습니다")
    return 0


def _cmd_done(args: argparse.Namespace, path: Path) -> int:
    todos = core.complete_todo(storage.load(path), args.id)
    storage.save(path, todos)
    print(f"{args.id}번 완료했습니다")
    return 0


COMMANDS = {
    "add": _cmd_add,
    "list": _cmd_list,
    "start": _cmd_start,
    "done": _cmd_done,
}


def run(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    path = storage.resolve_path(args.file)

    try:
        return COMMANDS[args.command](args, path)
    except (core.TodoError, storage.StorageError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1
