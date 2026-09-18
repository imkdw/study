from __future__ import annotations

import os
import time
from contextlib import contextmanager
from typing import Iterator

import pytest


@contextmanager
def set_tz(name: str) -> Iterator[None]:
    original_tz = os.environ.get("TZ")
    os.environ["TZ"] = name
    time.tzset()
    try:
        yield
    finally:
        if original_tz is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = original_tz
        time.tzset()


@pytest.fixture
def seoul_tz() -> Iterator[None]:
    with set_tz("Asia/Seoul"):
        yield


@pytest.fixture
def utc_tz() -> Iterator[None]:
    with set_tz("UTC"):
        yield
