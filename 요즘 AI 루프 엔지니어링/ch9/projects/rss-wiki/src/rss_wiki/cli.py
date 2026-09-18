import argparse
import sys

from rss_wiki.config import ConfigError, load_config
from rss_wiki.db import SchemaVersionError, connect
from rss_wiki.pipeline import collect, summarize_pending, write_wiki
from rss_wiki.summarize import ClaudeUnavailableError

DEFAULT_CONFIG = "feeds.yaml"
DEFAULT_MAX_SUMMARIES = 20


def _run(args: argparse.Namespace) -> int:
    try:
        config = load_config(args.config)
    except ConfigError as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1

    try:
        conn = connect(config.db_path)
    except SchemaVersionError as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1

    try:
        collected = collect(conn, config.feeds)
        try:
            summarized = summarize_pending(conn, max_summaries=args.max_summaries)
        except ClaudeUnavailableError as exc:
            print(f"오류: {exc}", file=sys.stderr)
            return 1
        write_wiki(conn, config.wiki_dir)
    finally:
        conn.close()

    print(f"새 글: {collected.new_articles}")
    print(f"요약 성공: {summarized.succeeded}")
    print(f"요약 실패: {summarized.failed}")
    print(f"포기한 글: {summarized.given_up}")
    print(f"실패한 피드: {collected.failed_feeds}")
    print(f"포기한 피드: {collected.given_up_feeds}")
    if summarized.given_up or collected.given_up_feeds:
        print('포기한 항목이 있습니다. README의 "포기한 글/피드 다시 시도하기"를 보세요.')
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="rss-wiki")
    subparsers = parser.add_subparsers(dest="command")

    run_parser = subparsers.add_parser(
        "run",
        help="수집/요약/위키 생성 파이프라인 실행",
        description="RSS 피드를 수집하고 본문을 요약해 위키를 생성한다.",
    )
    run_parser.add_argument("--config", default=DEFAULT_CONFIG)
    run_parser.add_argument("--max-summaries", type=int, default=DEFAULT_MAX_SUMMARIES)
    run_parser.set_defaults(func=_run)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_usage()
        return 1

    func = getattr(args, "func", None)
    if func is None:
        parser.print_usage()
        return 1

    return func(args)


if __name__ == "__main__":
    sys.exit(main())
