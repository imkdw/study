import json

import pytest

import main


@pytest.fixture
def quotes_file(tmp_path, monkeypatch):
    """테스트마다 임시 DB/시드 파일을 쓰게 해서 실제 데이터를 건드리지 않는다."""
    seed_path = tmp_path / "quotes.json"
    db_path = tmp_path / "quotes.db"
    monkeypatch.setattr(main, "QUOTES_FILE", seed_path)
    monkeypatch.setattr(main, "DB_FILE", db_path)

    def _write(quotes: list) -> None:
        # 호출부 시그니처는 그대로 두고, 내부에서 시드 JSON 을 만든 뒤 DB 는 비워 둔다.
        db_path.unlink(missing_ok=True)
        seed_path.write_text(
            json.dumps(quotes, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    return _write


SAMPLE = [
    {"text": "단순함은 궁극의 정교함이다.", "author": "레오나르도 다빈치"},
    {"text": "가장 큰 위험은 위험 없는 삶이다.", "author": "스티븐 코비"},
    {"text": "Simple is better than complex.", "author": "Tim Peters"},
]

WILDCARD_SAMPLE = SAMPLE + [
    {"text": "성공은 99% 노력이다.", "author": "토머스 에디슨"},
]


def test_본문에_키워드가_포함된_항목만_반환한다(quotes_file):
    quotes_file(SAMPLE)
    assert main.search_quotes("위험") == [SAMPLE[1]]


def test_여러_건이_매칭되면_원래_순서를_유지한다(quotes_file):
    quotes_file(SAMPLE)
    assert main.search_quotes("다") == [SAMPLE[0], SAMPLE[1]]


def test_대소문자를_무시한다(quotes_file):
    quotes_file(SAMPLE)
    assert main.search_quotes("SIMPLE") == [SAMPLE[2]]


def test_저자명은_검색_대상이_아니다(quotes_file):
    quotes_file(SAMPLE)
    assert main.search_quotes("다빈치") == []


def test_일치하는_항목이_없으면_빈_리스트(quotes_file):
    quotes_file(SAMPLE)
    assert main.search_quotes("없는키워드") == []


def test_cli가_매칭된_명언을_출력한다(quotes_file, capsys):
    quotes_file(SAMPLE)
    code = main.run_cli(["--search", "위험"])
    assert code == 0
    assert capsys.readouterr().out == "가장 큰 위험은 위험 없는 삶이다. - 스티븐 코비\n"


def test_cli는_매칭이_없으면_1을_반환한다(quotes_file, capsys):
    quotes_file(SAMPLE)
    code = main.run_cli(["--search", "없는키워드"])
    captured = capsys.readouterr()
    assert code == 1
    assert captured.out == ""
    assert "없습니다" in captured.err


def test_cli는_빈_키워드를_거부한다(quotes_file, capsys):
    quotes_file(SAMPLE)
    code = main.run_cli(["--search", "   "])
    assert code == 2
    assert "비어 있습니다" in capsys.readouterr().err


def test_cli는_키워드_값이_없으면_종료한다(quotes_file):
    quotes_file(SAMPLE)
    with pytest.raises(SystemExit) as exc:
        main.run_cli(["--search"])
    assert exc.value.code == 2


def test_인수가_없으면_mcp_서버를_띄운다(monkeypatch):
    called = []
    monkeypatch.setattr(main.mcp, "run", lambda: called.append(True))
    assert main.run_cli([]) == 0
    assert called == [True]


def test_cli는_시드_파일이_없으면_매칭_없음으로_1을_반환한다(
    tmp_path, monkeypatch, capsys
):
    monkeypatch.setattr(main, "QUOTES_FILE", tmp_path / "없는파일.json")
    monkeypatch.setattr(main, "DB_FILE", tmp_path / "quotes.db")
    code = main.run_cli(["--search", "위험"])
    captured = capsys.readouterr()
    assert code == 1
    assert captured.out == ""
    assert "없습니다" in captured.err


def test_cli는_DB를_열_수_없으면_2를_반환한다(quotes_file, tmp_path, monkeypatch, capsys):
    quotes_file(SAMPLE)
    # 존재하지 않는 디렉터리 아래를 가리키면 sqlite3 가 연결 단계에서 실패한다.
    monkeypatch.setattr(main, "DB_FILE", tmp_path / "없는디렉터리" / "quotes.db")
    code = main.run_cli(["--search", "위험"])
    captured = capsys.readouterr()
    assert code == 2
    assert captured.out == ""
    assert captured.err.strip() != ""


def test_init_db는_시드를_한_번만_옮긴다(quotes_file):
    quotes_file(SAMPLE)
    main.init_db()
    main.init_db()
    assert main.load_quotes() == SAMPLE


def test_시드_이후에는_시드_파일이_사라져도_DB가_남는다(quotes_file):
    quotes_file(SAMPLE)
    main.init_db()
    main.QUOTES_FILE.unlink()
    assert main.load_quotes() == SAMPLE


def test_add_quote로_넣은_명언이_목록에_나타난다(quotes_file):
    quotes_file(SAMPLE)
    before = main.load_quotes()
    message = main.add_quote("천천히 가도 멈추지만 않으면 된다.", "공자")

    assert message == f"명언을 추가했습니다. 현재 {len(before) + 1}개입니다."

    after = main.load_quotes()
    assert len(after) == len(before) + 1
    assert after[-1] == {"text": "천천히 가도 멈추지만 않으면 된다.", "author": "공자"}
    assert main.search_quotes("멈추지") == [
        {"text": "천천히 가도 멈추지만 않으면 된다.", "author": "공자"}
    ]


def test_LIKE_와일드카드는_글자_그대로_검색한다(quotes_file):
    quotes_file(WILDCARD_SAMPLE)
    # % 와 _ 가 이스케이프되지 않으면 전체 또는 다수가 매칭된다.
    assert main.search_quotes("%") == [WILDCARD_SAMPLE[3]]
    assert main.search_quotes("_") == []
    assert main.search_quotes("\\") == []
    assert main.search_quotes("99%") == [WILDCARD_SAMPLE[3]]
