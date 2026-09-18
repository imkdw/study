from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from rss_wiki import cli, main
from rss_wiki.config import ConfigError
from rss_wiki.db import SchemaVersionError
from rss_wiki.summarize import ClaudeUnavailableError


def test_entry_point_help_exits_zero_and_lists_run() -> None:
    result = subprocess.run(
        [sys.executable, "-c", "import sys; from rss_wiki import main; sys.exit(main(['--help']))"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    assert "run" in result.stdout


def test_no_subcommand_returns_one() -> None:
    assert main([]) == 1


def test_unknown_subcommand_exits_with_code_two() -> None:
    with pytest.raises(SystemExit) as excinfo:
        main(["bogus"])
    assert excinfo.value.code == 2


def _fake_config(feeds=None, wiki_dir=None, db_path=None) -> SimpleNamespace:
    return SimpleNamespace(
        feeds=feeds if feeds is not None else [],
        wiki_dir=wiki_dir if wiki_dir is not None else Path("/wiki"),
        db_path=db_path if db_path is not None else Path("/db"),
    )


def _install_pipeline_fakes(
    monkeypatch: pytest.MonkeyPatch,
    calls: list[tuple],
    *,
    config: SimpleNamespace | None = None,
    collect_result: SimpleNamespace | None = None,
    summarize_result: SimpleNamespace | None = None,
) -> tuple[SimpleNamespace, SimpleNamespace]:
    config = config or _fake_config()
    conn = SimpleNamespace(close=lambda: calls.append(("close",)))

    def fake_load_config(path: str) -> SimpleNamespace:
        calls.append(("load_config", path))
        return config

    def fake_connect(db_path: Path) -> SimpleNamespace:
        calls.append(("connect", db_path))
        return conn

    def fake_collect(c: SimpleNamespace, feeds: object) -> SimpleNamespace:
        calls.append(("collect", c, feeds))
        return collect_result or SimpleNamespace(new_articles=2, failed_feeds=0, given_up_feeds=0)

    def fake_summarize_pending(c: SimpleNamespace, *, max_summaries: int) -> SimpleNamespace:
        calls.append(("summarize_pending", c, max_summaries))
        return summarize_result or SimpleNamespace(succeeded=1, failed=1, given_up=0)

    def fake_write_wiki(c: SimpleNamespace, wiki_dir: object) -> int:
        calls.append(("write_wiki", c, wiki_dir))
        return 0

    monkeypatch.setattr(cli, "load_config", fake_load_config)
    monkeypatch.setattr(cli, "connect", fake_connect)
    monkeypatch.setattr(cli, "collect", fake_collect)
    monkeypatch.setattr(cli, "summarize_pending", fake_summarize_pending)
    monkeypatch.setattr(cli, "write_wiki", fake_write_wiki)
    return config, conn


def test_run_success_prints_six_lines(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    calls: list[tuple] = []
    _install_pipeline_fakes(monkeypatch, calls)

    exit_code = main(["run"])

    assert exit_code == 0
    lines = capsys.readouterr().out.splitlines()
    assert lines == [
        "새 글: 2",
        "요약 성공: 1",
        "요약 실패: 1",
        "포기한 글: 0",
        "실패한 피드: 0",
        "포기한 피드: 0",
    ]


def test_run_default_config_and_max_summaries(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple] = []
    _install_pipeline_fakes(monkeypatch, calls)

    main(["run"])

    load_call = next(c for c in calls if c[0] == "load_config")
    assert load_call[1] == "feeds.yaml"
    summarize_call = next(c for c in calls if c[0] == "summarize_pending")
    assert summarize_call[2] == 20


def test_run_passes_config_and_max_summaries_arguments(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple] = []
    _install_pipeline_fakes(monkeypatch, calls)

    main(["run", "--config", "other.yaml", "--max-summaries", "3"])

    load_call = next(c for c in calls if c[0] == "load_config")
    assert load_call[1] == "other.yaml"
    summarize_call = next(c for c in calls if c[0] == "summarize_pending")
    assert summarize_call[2] == 3


def test_run_config_error_returns_one_and_skips_rest(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    calls: list[tuple] = []

    def fake_load_config(path: str) -> SimpleNamespace:
        raise ConfigError("설정 파일을 찾을 수 없습니다: x")

    def fake_connect(db_path: Path) -> SimpleNamespace:
        calls.append(("connect", db_path))
        raise AssertionError("connect가 불리면 안 된다")

    def fake_collect(c: SimpleNamespace, feeds: object) -> SimpleNamespace:
        calls.append(("collect", c, feeds))
        raise AssertionError("collect가 불리면 안 된다")

    monkeypatch.setattr(cli, "load_config", fake_load_config)
    monkeypatch.setattr(cli, "connect", fake_connect)
    monkeypatch.setattr(cli, "collect", fake_collect)

    exit_code = main(["run"])

    assert exit_code == 1
    assert "설정 파일을 찾을 수 없습니다" in capsys.readouterr().err
    assert calls == []


def test_run_schema_version_error_returns_one_and_skips_collect(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    calls: list[tuple] = []

    def fake_load_config(path: str) -> SimpleNamespace:
        return _fake_config()

    def fake_connect(db_path: Path) -> SimpleNamespace:
        raise SchemaVersionError("DB 스키마 버전 3이 코드 버전 2보다 높습니다: x")

    def fake_collect(c: SimpleNamespace, feeds: object) -> SimpleNamespace:
        calls.append(("collect", c, feeds))
        raise AssertionError("collect가 불리면 안 된다")

    monkeypatch.setattr(cli, "load_config", fake_load_config)
    monkeypatch.setattr(cli, "connect", fake_connect)
    monkeypatch.setattr(cli, "collect", fake_collect)

    exit_code = main(["run"])

    assert exit_code == 1
    assert "스키마 버전" in capsys.readouterr().err
    assert calls == []


def test_run_claude_unavailable_returns_one_skips_write_wiki_and_closes_conn(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    calls: list[tuple] = []
    conn = SimpleNamespace(close=lambda: calls.append(("close",)))

    def fake_load_config(path: str) -> SimpleNamespace:
        return _fake_config()

    def fake_connect(db_path: Path) -> SimpleNamespace:
        return conn

    def fake_collect(c: SimpleNamespace, feeds: object) -> SimpleNamespace:
        return SimpleNamespace(new_articles=0, failed_feeds=0, given_up_feeds=0)

    def fake_summarize_pending(c: SimpleNamespace, *, max_summaries: int) -> SimpleNamespace:
        raise ClaudeUnavailableError("claude 명령을 찾을 수 없습니다")

    def fake_write_wiki(c: SimpleNamespace, wiki_dir: object) -> int:
        calls.append(("write_wiki", c, wiki_dir))
        return 0

    monkeypatch.setattr(cli, "load_config", fake_load_config)
    monkeypatch.setattr(cli, "connect", fake_connect)
    monkeypatch.setattr(cli, "collect", fake_collect)
    monkeypatch.setattr(cli, "summarize_pending", fake_summarize_pending)
    monkeypatch.setattr(cli, "write_wiki", fake_write_wiki)

    exit_code = main(["run"])

    assert exit_code == 1
    assert "claude 명령을 찾을 수 없습니다" in capsys.readouterr().err
    assert calls == [("close",)]


def test_run_calls_pipeline_in_order_with_expected_arguments(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple] = []
    config = _fake_config(feeds=["feed-a"], wiki_dir=Path("/some/wiki"))
    config, conn = _install_pipeline_fakes(monkeypatch, calls, config=config)

    main(["run"])

    kinds = [c[0] for c in calls if c[0] in ("collect", "summarize_pending", "write_wiki")]
    assert kinds == ["collect", "summarize_pending", "write_wiki"]

    collect_call = next(c for c in calls if c[0] == "collect")
    assert collect_call[1] is conn
    assert collect_call[2] is config.feeds

    write_wiki_call = next(c for c in calls if c[0] == "write_wiki")
    assert write_wiki_call[1] is conn
    assert write_wiki_call[2] is config.wiki_dir

    summarize_call = next(c for c in calls if c[0] == "summarize_pending")
    assert summarize_call[1] is conn


def test_run_success_closes_conn_exactly_once(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple] = []
    _install_pipeline_fakes(monkeypatch, calls)

    main(["run"])

    assert len([c for c in calls if c[0] == "close"]) == 1


def test_run_does_not_swallow_sqlite3_errors_but_closes_conn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import sqlite3

    calls: list[tuple] = []
    conn = SimpleNamespace(close=lambda: calls.append(("close",)))

    def fake_load_config(path: str) -> SimpleNamespace:
        return _fake_config()

    def fake_connect(db_path: Path) -> SimpleNamespace:
        return conn

    def fake_collect(c: SimpleNamespace, feeds: object) -> SimpleNamespace:
        raise sqlite3.OperationalError("boom")

    monkeypatch.setattr(cli, "load_config", fake_load_config)
    monkeypatch.setattr(cli, "connect", fake_connect)
    monkeypatch.setattr(cli, "collect", fake_collect)

    with pytest.raises(sqlite3.OperationalError):
        main(["run"])

    assert calls == [("close",)]


@pytest.mark.parametrize(
    ("given_up", "given_up_feeds", "expect_notice"),
    [
        (0, 0, False),
        (1, 0, True),
        (0, 1, True),
    ],
)
def test_run_prints_notice_line_only_when_something_was_given_up(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    given_up: int,
    given_up_feeds: int,
    expect_notice: bool,
) -> None:
    calls: list[tuple] = []
    _install_pipeline_fakes(
        monkeypatch,
        calls,
        collect_result=SimpleNamespace(new_articles=0, failed_feeds=0, given_up_feeds=given_up_feeds),
        summarize_result=SimpleNamespace(succeeded=0, failed=0, given_up=given_up),
    )

    main(["run"])

    out = capsys.readouterr().out
    assert ("포기한 항목이 있습니다" in out) is expect_notice


def test_run_help_exits_zero_with_description(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as excinfo:
        main(["run", "--help"])

    assert excinfo.value.code == 0
    assert "RSS 피드를 수집하고" in capsys.readouterr().out


def test_no_subcommand_prints_usage() -> None:
    import io
    import contextlib

    out = io.StringIO()
    err = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        exit_code = main([])

    assert exit_code == 1
    assert "usage" in (out.getvalue() + err.getvalue())


def test_run_without_func_defends_against_attribute_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_build_parser() -> argparse.ArgumentParser:
        parser = argparse.ArgumentParser(prog="rss-wiki")
        subparsers = parser.add_subparsers(dest="command")
        subparsers.add_parser("run")
        return parser

    monkeypatch.setattr(cli, "build_parser", fake_build_parser)

    assert main(["run"]) == 1


def test_run_integration_with_empty_feeds_creates_db_and_wiki(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    config_path = tmp_path / "feeds.yaml"
    config_path.write_text(
        "feeds: []\nwiki_dir: wiki\ndb_path: data/rss-wiki.db\n",
        encoding="utf-8",
    )

    exit_code = main(["run", "--config", str(config_path)])

    assert exit_code == 0
    assert (tmp_path / "data" / "rss-wiki.db").is_file()
    assert (tmp_path / "wiki" / "index.md").is_file()
    out = capsys.readouterr().out
    lines = out.splitlines()
    assert lines == [
        "새 글: 0",
        "요약 성공: 0",
        "요약 실패: 0",
        "포기한 글: 0",
        "실패한 피드: 0",
        "포기한 피드: 0",
    ]
    assert "포기한 항목이 있습니다" not in out
