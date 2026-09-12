import argparse
import json
import random
import sqlite3
import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("quote")  # ① 서버 객체 생성

QUOTES_FILE = Path(__file__).parent / "quotes.json"  # 시드 전용
DB_FILE = Path(__file__).parent / "quotes.db"


def connect() -> sqlite3.Connection:
    """quotes.db 커넥션을 열어 반환합니다(호출한 쪽에서 닫습니다)."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """테이블을 준비하고, 비어 있으면 quotes.json 으로 1회 시드합니다."""
    conn = connect()
    try:
        conn.execute(  # DDL 은 자동 커밋된다
            """
            CREATE TABLE IF NOT EXISTS quotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                author TEXT NOT NULL
            )
            """
        )
        with conn:  # with 블록을 벗어날 때 커밋
            # 비어 있는지 확인하는 것부터 쓰기 잠금을 잡아야, 같은 DB 를 동시에 처음
            # 여는 프로세스가 둘이어도 시드가 두 번 들어가지 않는다.
            conn.execute("BEGIN IMMEDIATE")
            empty = conn.execute("SELECT COUNT(*) FROM quotes").fetchone()[0] == 0
            if empty and QUOTES_FILE.exists():  # quotes.json → quotes.db 마이그레이션
                seed = json.loads(QUOTES_FILE.read_text(encoding="utf-8"))
                conn.executemany(
                    "INSERT INTO quotes (text, author) VALUES (?, ?)",
                    [(q["text"], q["author"]) for q in seed],
                )
    finally:
        conn.close()


def load_quotes() -> list:
    init_db()
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT text, author FROM quotes ORDER BY id"
        ).fetchall()
    finally:
        conn.close()
    return [{"text": row["text"], "author": row["author"]} for row in rows]


def search_quotes(keyword: str) -> list:
    """명언 본문에 keyword 가 포함된 항목만 골라 반환합니다(대소문자 무시)."""
    init_db()
    needle = keyword
    for special in ("\\", "%", "_"):  # LIKE 와일드카드 이스케이프
        needle = needle.replace(special, f"\\{special}")
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT text, author FROM quotes "
            "WHERE text LIKE ? ESCAPE '\\' ORDER BY id",
            (f"%{needle}%",),
        ).fetchall()
    finally:
        conn.close()
    return [{"text": row["text"], "author": row["author"]} for row in rows]


def format_quote(quote: dict) -> str:
    return f'{quote["text"]} - {quote["author"]}'


@mcp.tool()  # ② 무작위 명언 반환 도구
def get_random_quote() -> str:
    """무작위 명언 한 개를 반환합니다."""
    return format_quote(random.choice(load_quotes()))


@mcp.tool()  # ③ 명언 추가 도구(쓰기)
def add_quote(text: str, author: str) -> str:
    """새 명언을 명언 목록에 추가합니다."""
    init_db()
    conn = connect()
    try:
        with conn:
            conn.execute(
                "INSERT INTO quotes (text, author) VALUES (?, ?)", (text, author)
            )
        total = conn.execute("SELECT COUNT(*) FROM quotes").fetchone()[0]
    finally:
        conn.close()
    return f"명언을 추가했습니다. 현재 {total}개입니다."


@mcp.resource("quote://all")  # ④ 리소스
def all_quotes() -> str:
    """전체 명언 목록을 반환합니다."""
    return json.dumps(load_quotes(), ensure_ascii=False, indent=2)


@mcp.prompt()  # ⑤ 프롬프트
def quote_post(topic: str) -> str:
    """명언을 인용한 짧은 글을 작성합니다."""
    return (
        f"등록된 명언 중 '{topic}' 주제와 가장 어울리는 것을 quote://all에서 고르고, "
        "그 명언을 인용한 세 문단 분량의 짧은 글을 작성해주세요."
    )


def run_cli(argv: list[str] | None = None) -> int:  # ⑥ CLI 진입점
    """인수가 없으면 MCP 서버를 띄우고, --search 가 오면 검색 결과만 출력합니다."""
    parser = argparse.ArgumentParser(
        prog="quote-cli",
        description="인수 없이 실행하면 MCP 서버를 stdio 로 띄웁니다.",
    )
    parser.add_argument(
        "--search",
        metavar="KEYWORD",
        help="명언 본문에 키워드가 포함된 항목만 출력합니다.",
    )
    args = parser.parse_args(argv)

    if args.search is None:
        mcp.run()  # stdio 전송으로 서버 실행
        return 0

    keyword = args.search.strip()
    if not keyword:
        print("검색 키워드가 비어 있습니다.", file=sys.stderr)
        return 2

    try:
        matched = search_quotes(keyword)
    except OSError as exc:  # quotes.db 파일에 접근할 수 없음
        print(f"명언 데이터베이스에 접근할 수 없습니다: {exc}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as exc:  # 시드용 quotes.json 이 손상됨
        print(f"시드 파일(quotes.json)이 올바른 JSON 이 아닙니다: {exc}", file=sys.stderr)
        return 2
    except sqlite3.Error as exc:  # 손상된 quotes.db 또는 질의 실패
        print(f"명언 데이터베이스를 읽을 수 없습니다: {exc}", file=sys.stderr)
        return 2

    if not matched:
        print(f"'{keyword}' 이(가) 포함된 명언이 없습니다.", file=sys.stderr)
        return 1

    for quote in matched:
        print(format_quote(quote))
    return 0


if __name__ == "__main__":
    raise SystemExit(run_cli())
