import sys


def main() -> None:
    from todo_cli.cli import run

    sys.exit(run())
