import re
import time

from rss_wiki.timeutil import now_iso, struct_time_to_iso


def test_struct_time_to_iso_converts_utc_to_local(seoul_tz: None) -> None:
    value = time.struct_time((2026, 9, 17, 15, 13, 2, 0, 0, 0))

    assert struct_time_to_iso(value) == "2026-09-18T00:13:02+09:00"


def test_struct_time_to_iso_returns_none_for_none(seoul_tz: None) -> None:
    assert struct_time_to_iso(None) is None


def test_now_iso_matches_expected_format(seoul_tz: None) -> None:
    assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$", now_iso())


def test_now_iso_uses_utc_offset_when_tz_is_utc(utc_tz: None) -> None:
    assert now_iso().endswith("+00:00")


def test_struct_time_to_iso_clamps_leap_second(seoul_tz: None) -> None:
    value = time.struct_time((2026, 9, 17, 15, 13, 60, 3, 260, 0))

    assert struct_time_to_iso(value) == "2026-09-18T00:13:59+09:00"
