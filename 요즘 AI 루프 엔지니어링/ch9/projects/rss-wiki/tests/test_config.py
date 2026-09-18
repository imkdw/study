from pathlib import Path

import pytest

from rss_wiki.config import ConfigError, load_config


def _write(tmp_path: Path, name: str, content: str) -> Path:
    path = tmp_path / name
    path.write_text(content, encoding="utf-8")
    return path


def test_load_config_normal(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: https://example.com/feed.xml
    name: Example
  - url: https://another.example.com/rss
""",
    )

    config = load_config(config_path)

    assert len(config.feeds) == 2
    assert config.feeds[0].url == "https://example.com/feed.xml"
    assert config.feeds[0].name == "Example"
    assert config.feeds[1].url == "https://another.example.com/rss"


def test_load_config_name_omitted_is_none(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: https://example.com/feed.xml
""",
    )

    config = load_config(config_path)

    assert config.feeds[0].name is None


def test_load_config_missing_url_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - name: no url here
""",
    )

    with pytest.raises(ConfigError, match="url이 없습니다"):
        load_config(config_path)


def test_load_config_null_url_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url:
""",
    )

    with pytest.raises(ConfigError, match="url이 없습니다"):
        load_config(config_path)


def test_load_config_duplicate_url_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: https://example.com/feed.xml
  - url: https://example.com/feed.xml
""",
    )

    with pytest.raises(ConfigError, match="중복된 피드 url"):
        load_config(config_path)


def test_load_config_missing_file_raises(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match="설정 파일을 찾을 수 없습니다"):
        load_config(tmp_path / "does-not-exist.yaml")


def test_load_config_missing_feeds_key_raises(tmp_path: Path) -> None:
    config_path = _write(tmp_path, "feeds.yaml", "wiki_dir: wiki\n")

    with pytest.raises(ConfigError, match="feeds 키가 없습니다"):
        load_config(config_path)


def test_load_config_empty_url_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: ''
""",
    )

    with pytest.raises(ConfigError, match="url이 비어 있습니다"):
        load_config(config_path)


def test_load_config_whitespace_only_url_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: '   '
""",
    )

    with pytest.raises(ConfigError, match="url이 비어 있습니다"):
        load_config(config_path)


def test_load_config_url_is_stripped(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: '  https://example.com/feed.xml  '
""",
    )

    config = load_config(config_path)

    assert config.feeds[0].url == "https://example.com/feed.xml"


def test_load_config_duplicate_after_strip_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: 'https://example.com/feed.xml'
  - url: '  https://example.com/feed.xml  '
""",
    )

    with pytest.raises(ConfigError, match="중복된 피드 url"):
        load_config(config_path)


def test_load_config_wiki_dir_not_string_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: https://example.com/feed.xml
wiki_dir: 123
""",
    )

    with pytest.raises(ConfigError, match="wiki_dir은 문자열이어야"):
        load_config(config_path)


def test_load_config_db_path_not_string_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: https://example.com/feed.xml
db_path: 123
""",
    )

    with pytest.raises(ConfigError, match="db_path는 문자열이어야"):
        load_config(config_path)


def test_load_config_absolute_db_path_kept_as_is(tmp_path: Path) -> None:
    absolute_db = tmp_path / "elsewhere" / "rss-wiki.db"
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        f"""
feeds:
  - url: https://example.com/feed.xml
db_path: {absolute_db}
""",
    )

    config = load_config(config_path)

    assert config.db_path == absolute_db


def test_load_config_wiki_dir_home_expanded(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_home = tmp_path / "home"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))

    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: https://example.com/feed.xml
wiki_dir: ~/w
""",
    )

    config = load_config(config_path)

    assert config.wiki_dir == fake_home / "w"


def test_load_config_unknown_top_level_key_ignored(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: https://example.com/feed.xml
unknown_key: whatever
""",
    )

    config = load_config(config_path)

    assert len(config.feeds) == 1


def test_load_config_default_paths_are_absolute_relative_to_config_dir(
    tmp_path: Path,
) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: https://example.com/feed.xml
""",
    )

    config = load_config(config_path)

    assert config.wiki_dir == tmp_path / "wiki"
    assert config.db_path == tmp_path / "data" / "rss-wiki.db"
    assert config.wiki_dir.is_absolute()
    assert config.db_path.is_absolute()


def test_load_config_relative_paths_resolved_against_config_dir(
    tmp_path: Path,
) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: https://example.com/feed.xml
wiki_dir: custom-wiki
db_path: custom/db.sqlite3
""",
    )

    config = load_config(config_path)

    assert config.wiki_dir == tmp_path / "custom-wiki"
    assert config.db_path == tmp_path / "custom" / "db.sqlite3"


def test_load_config_feeds_not_list_raises(tmp_path: Path) -> None:
    config_path = _write(tmp_path, "feeds.yaml", "feeds: not-a-list\n")

    with pytest.raises(ConfigError, match="feeds는 목록이어야"):
        load_config(config_path)


def test_load_config_feed_item_not_mapping_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - https://example.com/feed.xml
""",
    )

    with pytest.raises(ConfigError, match="feeds 항목은 매핑이어야"):
        load_config(config_path)


def test_load_config_name_not_string_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: https://example.com/feed.xml
    name: 123
""",
    )

    with pytest.raises(ConfigError, match="name은 문자열이어야"):
        load_config(config_path)


def test_load_config_yaml_parse_error_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds: [
  - url: broken
""",
    )

    with pytest.raises(ConfigError, match="파싱할 수 없습니다"):
        load_config(config_path)


def test_load_config_top_level_not_mapping_raises(tmp_path: Path) -> None:
    config_path = _write(tmp_path, "feeds.yaml", "- just\n- a\n- list\n")

    with pytest.raises(ConfigError, match="형식이 올바르지 않습니다"):
        load_config(config_path)


def test_load_config_url_not_string_raises(tmp_path: Path) -> None:
    config_path = _write(
        tmp_path,
        "feeds.yaml",
        """
feeds:
  - url: 5
""",
    )

    with pytest.raises(ConfigError, match="url은 문자열이어야"):
        load_config(config_path)
