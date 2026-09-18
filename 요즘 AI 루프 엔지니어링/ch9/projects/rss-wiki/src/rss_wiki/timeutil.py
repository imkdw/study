from __future__ import annotations

import time
from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def struct_time_to_iso(value: time.struct_time | None) -> str | None:
    if value is None:
        return None

    fields = value[:5] + (min(value.tm_sec, 59),)
    utc_dt = datetime(*fields, tzinfo=timezone.utc)
    return utc_dt.astimezone().isoformat(timespec="seconds")
