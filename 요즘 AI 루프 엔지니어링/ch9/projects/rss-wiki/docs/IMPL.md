# IMPL — T11b

## 처리한 항목

T11b. `rss-wiki run` 전체 연결과 결과 요약 출력 (PRD 4.6 / 4.4 / 7절).

## 변경 파일

- `src/rss_wiki/cli.py`: `_run`을 실제 파이프라인(`load_config` → `connect` →
  `collect` → `summarize_pending` → `write_wiki`)으로 새로 작성. 모듈 최상단에서
  `ConfigError`/`load_config`, `SchemaVersionError`/`connect`,
  `collect`/`summarize_pending`/`write_wiki`, `ClaudeUnavailableError`를 이름으로
  import해 `_run`이 모듈 전역을 참조하게 함(monkeypatch 대상). `DEFAULT_CONFIG`,
  `DEFAULT_MAX_SUMMARIES` 상수 추가. `build_parser`의 `run` 서브파서에
  `--config`/`--max-summaries` 추가. `main`에 `func` 누락 방어 추가.
- `tests/test_cli.py`: 기존 `test_run_command_prints_not_implemented`를 삭제하고
  (a)~(n) 19개 테스트로 교체(3개는 기존 이름/로직 유지, (j)는 파라미터화 3경우).
- `tests/test_summarize_pending.py`: `test_summarize_pending_passes_max_summaries_as_limit`
  두 줄을 TASKS 지시대로 `list_calls`/`len` 방식으로 교체(호출 횟수 자체를
  단언하도록).
- `tests/test_config.py`: `test_load_config_null_url_raises` 1개 추가(`url:` 키만
  있고 값이 null인 경우).
- `pyproject.toml`: `description`을 README 첫 줄 문장으로 교체.
- `README.md`: "설정"/"전제" 절 신설, "실행" 절에 `--config`/`--max-summaries`와
  출력 여섯 줄 의미 보강.

## 검증 결과

- `uv run pytest --collect-only -q` (작업 시작 시): **351 tests collected**
  (TASKS의 "직전 사이클 기준선 351"과 일치)
- `uv run pytest tests/test_cli.py -v`: **19 passed** ((a)~(n) 각각 별도 테스트로
  존재, (j)는 파라미터화 3경우, 기존 3개 이름 그대로 유지)
- `uv run pytest tests/test_summarize_pending.py -v`: **11 passed**
  (작업 전/후 동일 — 수정은 두 줄뿐, 새 테스트 없음)
- `uv run pytest tests/test_config.py -v`: **24 passed**
  (작업 전 23 → 작업 후 24, `test_load_config_null_url_raises` 1개 추가)
- `uv run pytest -q` 전체: **367 passed** (작업 전 351 → 367, 신규 16개:
  test_cli.py 순증 15개 + test_config.py 1개)
- `TZ=UTC uv run pytest -q`: **367 passed**
- `uv run rss-wiki run --help`: 종료 코드 0, 출력에 `--config`/`--max-summaries`
  모두 포함
- `uv run rss-wiki run --config /tmp/rss-wiki-nope.yaml`: 종료 코드 1, stderr
  `오류: 설정 파일을 찾을 수 없습니다: /tmp/rss-wiki-nope.yaml` 한 줄, 스택
  트레이스 없음
- 빈 임시 디렉터리(`feeds: []`)에서 `uv run rss-wiki run --config <파일>`:
  종료 코드 0, 같은 디렉터리에 `wiki/index.md`와 `data/rss-wiki.db` 생성 확인.
  출력:
  ```
  새 글: 0
  요약 성공: 0
  요약 실패: 0
  포기한 글: 0
  실패한 피드: 0
  포기한 피드: 0
  ```
- grep 확인 (모두 결과 없음, 의도한 대로):
  - `grep -n "not implemented" src/rss_wiki/cli.py tests/test_cli.py`
  - `grep -nE "except Exception|except BaseException" src/rss_wiki/cli.py`
  - `grep -n "Add your description here" pyproject.toml`
  - `grep -nE "import (httpx|trafilatura|feedparser|sqlite3)" src/rss_wiki/cli.py`
  - `grep -n "cp feeds.example.yaml\|--max-summaries\|claude" README.md` → 결과 있음(의도한 대로)

## shasum (손대지 않는 src 8개)

작업 전(첫 편집 전에 잼):
```
796d853f83d6a3923619dada206c3a639a05555b  src/rss_wiki/config.py
569576cc7d6aef0e0e8f843181ded48f8445ea9d  src/rss_wiki/db.py
f1f1c232d4b8f4219e53cb625b80b710e04b3c2a  src/rss_wiki/extract.py
702c75418b1a5a344b5ef005db0ee4d49cdfb390  src/rss_wiki/fetch.py
0bed112274bd44f789bbfde1aa7c6093fc7744dd  src/rss_wiki/pipeline.py
e42839369e9cd2013d365ba6229ebcf721485aba  src/rss_wiki/summarize.py
25c68bec37d6366b79c6e3e5200f2797e1cb9ae8  src/rss_wiki/timeutil.py
3480e4ea92a699001b1ab9444aceec24ff20e27c  src/rss_wiki/wiki.py
```

작업 후(종료 시 잼): 위와 완전히 동일(diff 없음).

## 뮤테이션 (임시 복사본, `PYTHONPATH`로 복사본 로드 확인 후 진행)

복사본 로드 확인: `PYTHONPATH=<복사본>/src <복사본>/.venv/bin/python -c
"import rss_wiki.cli as m; print(m.__file__)"` → 복사본 경로 출력 확인.
복사본 기준선: `uv run pytest -q` 대신 `<복사본>/.venv/bin/python -m pytest -q`로
**367 passed** 확인 후 각 뮤테이션 적용.

1. `--max-summaries` 기본값 `20`→`5`: `-k` 없음(전체) → **1 failed, 366 passed**
   (`test_run_default_config_and_max_summaries` 실패)
2. `--config` 기본값 `"feeds.yaml"`→`"config.yaml"`: 전체 →
   **1 failed, 366 passed** (`test_run_default_config_and_max_summaries` 실패)
3. `ConfigError`를 잡는 부분에서 `return 1`→`return 0`: 전체 →
   **1 failed, 366 passed** (`test_run_config_error_returns_one_and_skips_rest` 실패)
4. `ClaudeUnavailableError`를 잡지 않고 `summarize_pending` 호출을 맨 줄로 둠:
   전체 → **1 failed, 366 passed**
   (`test_run_claude_unavailable_returns_one_skips_write_wiki_and_closes_conn` 실패,
   예외가 테스트 밖으로 그대로 올라옴)
5. `write_wiki` 호출을 지움: 전체 → **2 failed, 365 passed**
   (`test_run_calls_pipeline_in_order_with_expected_arguments`,
   `test_run_integration_with_empty_feeds_creates_db_and_wiki` 실패)
6. `ClaudeUnavailableError`를 잡은 뒤에도 `write_wiki`를 부르고 `return 0`:
   `-k test_cli` → **1 failed, 18 passed, 348 deselected**
   (`test_run_claude_unavailable_returns_one_skips_write_wiki_and_closes_conn` 실패)
7. `finally: conn.close()`를 지움: `-k test_cli` →
   **3 failed, 16 passed, 348 deselected**
   (`test_run_claude_unavailable_...`, `test_run_success_closes_conn_exactly_once`,
   `test_run_does_not_swallow_sqlite3_errors_but_closes_conn` 실패)
8. 포기 안내 줄을 포기 수와 무관하게 늘 출력: `-k test_cli` →
   **3 failed, 16 passed, 348 deselected**
   (`test_run_success_prints_six_lines`,
   `test_run_prints_notice_line_only_when_something_was_given_up[0-0-False]`,
   `test_run_integration_with_empty_feeds_creates_db_and_wiki` 실패)
9. `summarize_pending(conn, max_summaries=args.max_summaries)`의 인자를 상수
   `20`으로 바꿈: `-k test_cli` → **1 failed, 18 passed, 348 deselected**
   (`test_run_passes_config_and_max_summaries_arguments` 실패)
10. `pipeline.summarize_pending`의 `articles = list_articles(...)` 줄 바로 뒤에
    같은 줄을 한 번 더 추가(T11a에서 생존했던 뮤테이션): `-k
    test_summarize_pending` → **1 failed, 10 passed, 356 deselected**
    (`test_summarize_pending_passes_max_summaries_as_limit` 실패 — T11a REVIEW
    메모 1이 지적한 뮤테이션이 이번 수정으로 사망함을 확인)

모든 뮤테이션 적용 후 원본 파일로 복구, 복사본 전체 재실행으로 367 passed 확인 후
임시 디렉터리 삭제.

## 자체 결정

- (TASKS 원문 그대로 구현, 새 자체 결정 없음) `_run`의 오류 처리/호출 순서/출력
  문구는 TASKS에 적힌 리터럴을 그대로 옮겼다. 기본값(`feeds.yaml`, `20`)과
  출력 여섯 줄 문구는 테스트에도 리터럴로 적고 `cli.DEFAULT_*`에서 가져오지
  않았다(T6e REVIEW 메모 1).
- 테스트 헬퍼(`_fake_config`, `_install_pipeline_fakes`)는 구현 세부(내부 구조)라
  자체 결정 목록에 넣지 않는다 — 각 테스트의 기대값은 모두 리터럴이다.

## 참고

- 새 의존성 추가 없음.
- 미착수 항목 없음(T11b 하나만 선정되어 전부 처리).
