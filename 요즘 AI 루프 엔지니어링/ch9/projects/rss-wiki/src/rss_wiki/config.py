from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml

DEFAULT_WIKI_DIR = "wiki"
DEFAULT_DB_PATH = "data/rss-wiki.db"


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class FeedConfig:
    url: str
    name: str | None = None


@dataclass(frozen=True)
class Config:
    feeds: list[FeedConfig]
    wiki_dir: Path
    db_path: Path


def _resolve_path(value: str, base_dir: Path) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    return base_dir / path


def _parse_feeds(raw: dict, config_path: Path) -> list[FeedConfig]:
    if "feeds" not in raw:
        raise ConfigError(f"feeds 키가 없습니다: {config_path}")

    feeds_raw = raw["feeds"]
    if not isinstance(feeds_raw, list):
        raise ConfigError(f"feeds는 목록이어야 합니다: {config_path}")

    feeds: list[FeedConfig] = []
    seen_urls: set[str] = set()
    for item in feeds_raw:
        if not isinstance(item, dict):
            raise ConfigError(f"feeds 항목은 매핑이어야 합니다: {item!r}")

        url = item.get("url")
        if url is None:
            raise ConfigError(f"feeds 항목에 url이 없습니다: {item!r}")
        if not isinstance(url, str):
            raise ConfigError(f"url은 문자열이어야 합니다: {item!r}")
        url = url.strip()
        if not url:
            raise ConfigError(f"url이 비어 있습니다: {item!r}")
        if url in seen_urls:
            raise ConfigError(f"중복된 피드 url입니다: {url}")
        seen_urls.add(url)

        name = item.get("name")
        if name is not None and not isinstance(name, str):
            raise ConfigError(f"name은 문자열이어야 합니다: {item!r}")

        feeds.append(FeedConfig(url=url, name=name))

    return feeds


def load_config(path: str | Path) -> Config:
    config_path = Path(path).expanduser()
    if not config_path.is_absolute():
        config_path = Path.cwd() / config_path

    if not config_path.is_file():
        raise ConfigError(f"설정 파일을 찾을 수 없습니다: {config_path}")

    try:
        with config_path.open("r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
    except yaml.YAMLError as exc:
        raise ConfigError(f"설정 파일을 파싱할 수 없습니다: {exc}") from exc

    if not isinstance(raw, dict):
        raise ConfigError(f"설정 파일 형식이 올바르지 않습니다: {config_path}")

    feeds = _parse_feeds(raw, config_path)

    base_dir = config_path.parent

    wiki_dir_raw = raw.get("wiki_dir", DEFAULT_WIKI_DIR)
    if not isinstance(wiki_dir_raw, str):
        raise ConfigError(f"wiki_dir은 문자열이어야 합니다: {wiki_dir_raw!r}")

    db_path_raw = raw.get("db_path", DEFAULT_DB_PATH)
    if not isinstance(db_path_raw, str):
        raise ConfigError(f"db_path는 문자열이어야 합니다: {db_path_raw!r}")

    return Config(
        feeds=feeds,
        wiki_dir=_resolve_path(wiki_dir_raw, base_dir),
        db_path=_resolve_path(db_path_raw, base_dir),
    )
