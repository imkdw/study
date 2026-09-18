# rss-wiki PLAN

- 기준 문서: docs/PRD.md (초안 v1, 합의 결정 11건 반영)
- 갱신: 2026-09-18, 사이클 45 (T11b PASS 12/12, **종료 판정 완료**)

## 현재 상태

- M1 완료(T1~T3d): 의존성, `cli.py` argparse 골격, `config.py`의 `load_config`, `db.py`의 `connect`와 스키마, `timeutil.py`(`now_iso`, 윤초를 59로 자르는 `struct_time_to_iso`).
- M2 완료(T4a~T5c): `fetch.py`의 `parse_feed`/`fetch_feed`, `db.py`의 `skipped_keys`(`SCHEMA_VERSION = 2`), `get_or_create_feed`, `register_entries`, `record_feed_success`/`record_feed_failure`, `pipeline.py`의 `collect`.
- M3 완료(T6~T8c): `extract.py`, `summarize.py`(예외 계층과 `call_claude`/`summarize_body`/`check_claude`), `db.py`의 `list_pending_articles`/`save_article_body`/`record_article_failure`/`list_tag_names`/`save_summary`/`get_feed_failures`와 `GIVE_UP_THRESHOLD = 3`, `pipeline.py`의 `prepare_body`/`summarize_article`과 포기 피드 건너뛰기. 전체 268개 통과(TZ=UTC 포함, REVIEW 기록). 글/피드 양쪽 포기 전환과 `get_feed_failures`의 조회 전용 계약 고정까지 끝났다.
- M4 완료(T8c~T10c): PRD 4.5의 세 산출물(글 파일 / 주제 페이지 / 인덱스)이 모두 실제 파일로 쓰이고 태그 페이지 링크의 충돌 케이스도 리터럴로 고정됐다.
- M5 완료(T11a~T11b): T11a로 요약 루프(`pipeline.summarize_pending`, `db.count_given_up_articles`)가 들어왔고, T11b PASS 12/12로 `cli.py`가 `load_config` → `connect` → `collect` → `summarize_pending` → `write_wiki`를 실제로 잇는다(`cli.py:13-45`). `--config`(기본 `feeds.yaml`)/`--max-summaries`(기본 20) 인자와 결과 여섯 줄 출력, 포기 안내 줄, 세 예외의 종료 코드 1 변환까지 모두 코드에 있다. 전체 367 통과(TZ=UTC 포함, REVIEW 재현).
- **종료 판정: DONE.** 이번 사이클에 PRD.md를 처음부터 다시 읽고 각 요구를 Glob/Read/Grep으로 실제 코드와 대조했다. 대응하지 않는 요구가 없다 — 4.1 `config.py`(`load_config`/`FeedConfig`/`wiki_dir`/`db_path`), 4.2 `fetch.py`(`parse_feed`/`fetch_feed`) + `db.register_entries`(`FIRST_RUN_LIMIT = 10`, `skipped_keys`) + `pipeline.collect`, 4.3 `extract.py`(`fetch_article_html`/`extract_text`/`html_to_text`/`choose_body`/`truncate_for_summary`, `SUMMARY_INPUT_LIMIT = 20_000`이 `summarize.build_prompt:56`에서 실제로 쓰임) + `pipeline.prepare_body`, 4.4 `summarize.py`(`CLAUDE_TIMEOUT = 180.0`, 모델 미지정, `parse_summary_output`, `normalize_tag`, `check_claude`) + `pipeline.summarize_pending` + `cli.DEFAULT_MAX_SUMMARIES = 20`, 4.5 `wiki.py`(`slugify`/`assign_filenames`/`render_article`/`assign_tag_filenames`/`render_tag_page`/`render_index`/`write_article_files`/`write_tag_pages`/`write_index`, `TAGS_DIRNAME`/`INDEX_FILENAME`/`INDEX_RECENT_LIMIT = 20`) + `pipeline.write_wiki`, 4.6 `cli.py`, 5절 `db.SCHEMA`의 여섯 테이블(`feeds`/`articles`/`summaries`/`tags`/`article_tags`/`skipped_keys`, `SCHEMA_VERSION = 2`)과 `timeutil`의 오프셋 포함 ISO8601, 7절 `GIVE_UP_THRESHOLD = 3`과 피드/글 양쪽 포기 전환과 `ClaudeUnavailableError` → 종료 코드 1, 8절 `rss-wiki` 진입점.
- 직전 REVIEW(T11b PASS 12/12) 메모 반영: **필수 메모가 없다**(조건부가 아닌 완전 PASS). 메모 1(`오류: ` 접두사 미고정)과 메모 2(`run --help`에 `help=` 없음), 메모 3(`--max-summaries` 음수는 `pipeline.py:199-200` 가드가 막아 버그 아님)은 셋 다 평가자가 "새 항목을 만들지 말 것"을 권고한 정보성이라 항목화하지 않았다. 나중에 `cli.py`를 다시 만지는 일이 생기면 메모 2의 `help=` 두 줄이 가장 값싼 개선이다. 메모 4(커밋 부재)는 아래 사람 검토 메모로 16사이클째, 메모 5(다음은 커밋 → 실제 피드로 사람 손 검증 → 거기서 나온 것만 항목화)는 아래 "종료 이후" 절로 옮겼다.
- 이번 사이클 선정: **없음(신규 항목 없음)**. TASKS의 모든 항목이 완료이고 직전 REVIEW가 PASS이며 PRD 전체 대조에서 간극이 나오지 않았다. 억지로 항목을 만들지 않고 `docs/DONE`을 만들어 루프를 닫는다.

## 종료 이후 (사람이 할 일)

1. **커밋.** `src/rss_wiki/` 전체와 `tests/`, `docs/`가 아직 untracked다. 16사이클 동안 평가자가 매번 `shasum`과 `ls -lT` mtime으로 변경 범위를 우회 검증했다. 한 번 커밋해 두면 다음부터 `git diff --stat` 한 줄로 끝난다.
2. **실제 피드로 한 번 돌려 보기.** 현재 367개 테스트 중 실제 HTTP나 `claude` 호출을 하는 것은 하나도 없다. 네트워크와 `claude` 구독 한도가 필요해 자동 테스트로 덮이지 않는 유일한 구간이다. `cp feeds.example.yaml feeds.yaml` 후 실제 URL 두어 개로 `uv run rss-wiki run`을 돌려 위키 산출물을 눈으로 본다.
3. **거기서 드러난 것만** PRD/TASKS에 새 항목으로 올린다. 지금 예측으로 만들지 않는다.
- 자체 결정(유지, T11b): `_run`이 종료 코드 1로 바꾸는 예외는 `ConfigError`, `db.SchemaVersionError`, `ClaudeUnavailableError` 셋이다. `ConfigError`는 PRD가 요구하지 않았지만 T1b 이후 계속 계획에 있었고, `SchemaVersionError`는 사람이 고쳐야 하는 설정/DB 문제라 스택 트레이스 대신 한 줄 메시지가 맞다. `ClaudeUnavailableError`는 PRD 7절이 "명확한 오류로 종료"라고 직접 적은 경우다. 그 밖의 예외(`sqlite3.Error` 등)는 잡지 않고 그대로 올려 버그를 숨기지 않는다.
- 자체 결정(유지, T11b): 결과 출력은 여섯 줄 고정이다 — `새 글: n` / `요약 성공: n` / `요약 실패: n` / `포기한 글: n` / `실패한 피드: n` / `포기한 피드: n`. PRD 4.6이 요구한 네 항목(새 글/성공/실패/포기)에 `CollectResult`의 피드 쪽 두 필드를 더한 모양이다(T8b REVIEW 메모 5). 사람이 읽는 줄이라 되돌리기 쉽고 decisions로 올리지 않는다.
- 자체 결정(유지, T11b): `write_wiki`는 요약 성공 수와 무관하게 **매 실행 부른다**. PRD 4.5가 주제 페이지와 인덱스를 "매 실행 시 재생성"으로 못박았고, 요약이 0개인 실행에서도 DB에 이미 있는 글로 위키가 복원돼야 하기 때문이다(PRD 5절 "위키 폴더는 DB로부터 다시 만들 수 있어야 한다").
- 자체 결정(유지, T11a): 요약 루프 `summarize_pending`은 한 호출에서 `list_pending_articles(conn, max_summaries)`를 **한 번만** 조회하고 그 목록만 돈다. 루프 안에서 다시 조회하지 않는다. 근거는 둘이다. (1) `record_article_failure`가 3회째에 `given_up`으로 바꾸므로 재조회 없이도 다음 실행에서 자연히 빠진다. (2) 재조회 루프는 상한 계산이 두 곳으로 갈라지고 실패 글이 같은 실행에서 다시 잡힐 여지가 생긴다. 이 계약은 아직 테스트로 고정돼 있지 않아 T11b에서 호출 횟수 단언 한 줄을 더한다(REVIEW 메모 1).
- 자체 결정(유지, T11a): `max_summaries`가 0 이하면 조회도 `check_claude`도 하지 않고 빈 결과를 돌려준다. SQLite의 `LIMIT -1`은 "상한 없음"이라 음수를 그대로 넘기면 상한이 조용히 사라진다. PRD 4.4의 상한 취지와 반대 방향이므로 함수 입구에서 막는다.
- 자체 결정(유지, T11a): 글 포기 수는 루프 **전후 `count_given_up_articles` 스냅샷의 차이**로 센다(이번 실행에서 포기로 넘어간 글 수). 누적 개수가 아니라 델타를 쓰는 이유는 `CollectResult.given_up_feeds`가 이미 실행당 델타이고, PRD 4.6의 출력 네 항목이 모두 "이번 실행" 기준이라 섞이면 사용자가 읽을 수 없기 때문이다.
- 자체 결정(유지, T11a): `check_claude`는 요약할 글이 **1개 이상일 때만** 실행당 1회 부른다. PRD 7절은 "요약 단계 시작 전에 확인"이라고만 적었고, 요약할 글이 없는 실행에서까지 짧은 프롬프트 1회를 소모하면 구독 한도를 이유 없이 쓴다.
- 자체 결정(유지, T10b, PRD 4.5에 반영): 어떤 글에도 붙지 않게 된 낡은 주제 페이지는 지우지 않고 남긴다. PRD 4.1의 "이미 만든 위키 파일은 지우지 않는다"를 따르는 쪽이고, 파일 삭제는 판단이 틀렸을 때 되돌릴 수 없어 자체 결정으로 넣지 않는다. 인덱스는 현재 태그만 싣기 때문에 사용자 눈에는 목록에서 사라진 것으로 보인다.
- 자체 결정(유지, T10b): `pipeline.write_wiki`의 반환값은 **글 파일 수 그대로** 둔다(전체 파일 수로 바꾸지 않는다). 근거는 셋이다. (1) PRD 4.6이 출력하라고 한 것은 새 글/성공/실패/포기 수이고 파일 수가 아니다. (2) T9c 테스트 (a)/(d)가 "반환값 == `write` dict 길이", "빈 목록이면 0"으로 계약을 고정했고, 인덱스를 항상 쓰면 (d)가 1이 되어 이유 없이 계약이 깨진다. (3) 주제 페이지와 인덱스는 매 실행 재생성이라 세어도 정보가 없다. 대신 docstring의 "쓴 파일 수"를 "쓴 글 파일 수"로 고친다.
- 자체 결정(유지, T10b): `write_tag_pages`와 `write_index`는 둘 다 `(wiki_dir, articles)`만 받고 태그 파일 이름을 각자 `assign_tag_filenames`로 구한다. 한쪽이 계산한 값을 다른 쪽에 넘기지 않는다. `assign_tag_filenames`가 같은 태그 집합에서 결정적이므로(T10a (i)) 두 결과는 구조적으로 일치하고, 인자 전달 경로가 없어 어긋날 자리가 생기지 않는다. 일치 여부는 T10b 테스트 (h)가 실제 파일 존재로 확인한다.
- 자체 결정(유지): `wiki.py`는 `WikiArticle`을 자기 모듈에 정의하고 `db.py`는 `SummarizedArticle`을 자기 모듈에 정의한다. 두 모듈은 서로 import 하지 않고, 둘을 잇는 변환은 `pipeline`이 맡는다(`EntryLike`/`PendingArticle`과 같은 방향).
- 자체 결정(유지, T9c): `SummarizedArticle.feed_name`이 falsy(`None` 또는 `""`)면 `feed_url`을 피드 이름 자리에 넣는다. `None`만 거르면 빈 이름이 `slugify("")` → `untitled` 폴더로 뭉쳐 서로 다른 피드가 섞인다.
- 자체 결정(유지, T10a, PRD 4.5에 반영): (1) 주제 페이지는 위키 루트 `tags/` 폴더 아래 `{태그 slug}.md`다. slug가 겹치는 태그가 있으면 `assign_filenames`와 같은 방식으로 `-2`/`-3`을 붙인다. (2) 최신순 기준 시각은 `published_at`이고 `None`/파싱 불가/naive면 `created_at`, 둘 다 못 쓰면 맨 뒤(같은 자리끼리는 `id` 오름차순)다. (3) 인덱스의 피드별 최근 글은 피드당 20개까지다. 셋 다 DB에서 다시 만들 수 있는 산출물 모양이라 되돌리기 쉽고 decisions로 올리지 않는다.
- 자체 결정(유지, T10a): 글 파일 경로 계산은 `article_relpaths` 한 곳에 있고 `write_article_files`가 그 함수를 쓴다. 평가자 뮤테이션 E7(경로 구분자 변경)이 쓰기 테스트 6개를 함께 죽여 이 단일화가 테스트로 지켜짐이 확인됐다. `tags/` 폴더 이름이 어떤 피드 이름의 slug와 같으면 한 폴더에 섞이는 문제는 T10b에서도 그대로 받아들인다. `tags`로 slug 되는 피드 이름이 실제 입력으로 나올 가능성이 낮고, 막으려면 피드 폴더 이름 규칙을 바꿔야 해서 T9b/T10a가 고정한 계약을 깨야 한다.
- 메모(사람 검토, 16사이클째, **루프 종료 시점에도 남아 있음**): `src/rss_wiki/` 전체와 `tests/`, `docs/`가 여전히 untracked다. T11b 평가는 손대지 않는 src 8개의 shasum 일치와 `ls -lT` mtime 두 경로로 범위를 검증했고 실제로 깨끗했지만, 이건 매 사이클 평가자가 우회로를 새로 만들어 내는 비용이었다. 위 "종료 이후" 1번이 이 메모의 마무리다. Planner는 Bash가 없고 Evaluator는 `src/`/`tests/` 수정 권한이 없어 사람이 해야 한다.

## 모듈 책임 (목표 구조)

| 모듈 | 책임 |
| --- | --- |
| `rss_wiki/cli.py` | argparse 진입점, `run` 서브커맨드(`--config` 기본 `feeds.yaml`, `--max-summaries` 기본 20), `set_defaults(func=...)` 디스패치와 `func` 누락 방어. `_run`이 `load_config` → `connect` → `collect` → `summarize_pending` → `write_wiki`를 순서대로 부르고 여섯 줄짜리 결과 요약을 stdout에 출력한다. `ConfigError`/`SchemaVersionError`/`ClaudeUnavailableError`는 stderr 한 줄과 종료 코드 1로 바꾸고 그 밖의 예외는 올린다(자체 결정). 연결은 성공/오류 어느 경로에서도 닫는다. 파이프라인 함수를 모듈 전역 이름으로 참조해 테스트가 `monkeypatch.setattr(cli, ...)`로 대체할 수 있게 둔다(T11b) |
| `rss_wiki/config.py` | `feeds.yaml` 로드와 검증(url은 strip 후 비어 있으면 오류, strip 값 기준 중복 검사), 피드 목록과 `wiki_dir`/`db_path`(기본 `./wiki`, `./data/rss-wiki.db`, `feeds.yaml` 디렉터리 기준 해석) 반환 |
| `rss_wiki/db.py` | SQLite 연결(외래 키 활성화), 스키마 생성과 `PRAGMA user_version` 확인/기록(코드 버전보다 크면 오류), 피드 조회/생성, 새 글 등록(첫 수집 피드는 발행일 최신 10개만, 나머지 키는 `skipped_keys`), 글/요약/태그 저장 조회. 글 실패 기록은 증가한 `failure_count`가 `GIVE_UP_THRESHOLD`(3, 코드 상수)에 닿으면 `given_up`으로, 요약 저장은 한 트랜잭션에서 태그/요약/상태를 쓰고 예외 시 rollback 하며 `failure_count`/`last_error`를 함께 비운다(INSERT 순서는 고정 요구가 아니다, T8a REVIEW 메모 1). 피드의 연속 실패 횟수는 조회 전용 `get_feed_failures`로 읽는다(없는 피드는 `None`, 행을 만들지 않는다). 요약 완료 글은 `list_summarized_articles`가 `articles`/`summaries`/`feeds`/태그를 모아 `SummarizedArticle`(피드 이름과 URL 둘 다, JSON 목록은 디코딩해서)로 id 오름차순으로 돌려준다(T9b). 포기한 글 수는 조회 전용 `count_given_up_articles`가 `status = 'given_up'` 행만 세어 돌려준다(행을 만들지 않는다, T11a). `fetch.py`/`wiki.py`를 import하지 않고 Protocol과 자기 dataclass로 주고받는다 |
| `rss_wiki/timeutil.py` | 현재 시각과 피드 발행일(UTC `struct_time`)을 로컬 오프셋 포함 ISO8601 문자열로 만드는 헬퍼(초 60은 59로 자름) |
| `rss_wiki/fetch.py` | 피드 바이트 파싱(feedparser)과 항목 정규화(식별 키는 원문, 발행일, content, link는 기준 URL로 절대화한 http(s)만), 빈 응답/비피드 입력은 `FeedParseError`, 피드 HTTP 요청(`fetch_feed`, 비 2xx/전송 오류/URL 형식 오류는 `FeedFetchError`, 호출부는 `httpx` 예외를 직접 다루지 않음) |
| `rss_wiki/extract.py` | 원문 HTML 요청(`fetch_article_html`, 비 2xx/전송 오류/URL 형식 오류는 `ArticleFetchError`, `from exc` 유지), 본문 추출(trafilatura), 피드 content HTML 조각 텍스트화(파서 `close()`로 꼬리 보존, 블록 태그는 줄바꿈, script/style 제외, CRLF/공백/빈 줄 정리), 본문 선택(추출문 200자 미만이면 피드 content 대체), 요약 입력 20,000자 자르기. DB를 모른다(저장은 pipeline이 db 함수로) |
| `rss_wiki/summarize.py` | `claude` 사전 확인(`ClaudeUnavailableError`), `claude -p` 호출(stdin, 모델 미지정, 타임아웃 180초, `run` 주입), 기존 태그 목록 프롬프트 주입(인자로 받음), JSON 파싱 검증, 태그 정규화. 글 실패 대상 예외는 `SummaryError` 계열(실행 오류/타임아웃/종료 코드/출력 디코딩 실패/형식 오류). DB를 모른다 |
| `rss_wiki/wiki.py` | 위키 산출물 생성. 순수 함수 층(T9a, T9a2): 입력 dataclass `WikiArticle`을 직접 정의하고(DB를 모른다) slug 만들기(한글/영문/숫자 유지, 나머지는 `-`, 최대 80자), 날짜 선택(`published_at` 없으면 `created_at`의 앞 10자), 한 피드 폴더 안에서 결정적인 파일 이름 배정(글 id 오름차순, 충돌은 **이미 배정된 최종 이름 집합** 기준으로 `-2`/`-3`, 그래서 slug 자체가 `x-2`인 글과도 겹치지 않는다), frontmatter(6개 키 고정 순서) + 본문 마크다운 렌더(절 순서 `3줄 요약` → `핵심 포인트` → `원문` 고정, 각 절 아래 내용 대응은 T9b (s)로 고정, 끝 개행). 파일 쓰기 층(T9b, 완료): 피드별 폴더(`feed_dirname`)를 만들고 글 파일을 UTF-8 / `\n`으로 쓴다. 기존 파일은 덮어쓰지만 위키 폴더의 다른 파일은 지우지 않는다(PRD 4.1). 입력 목록의 순서에 의존하지 않고 글 id로 이름을 배정한다. `sqlite3`/`httpx`/`trafilatura`/`db`는 import 하지 않는다. 주제 페이지/인덱스 순수 층(T10a, 완료): 글 id → 위키 루트 기준 상대 경로를 돌려주는 `article_relpaths`(`write_article_files`가 같은 함수를 써서 링크와 실제 파일이 어긋나지 않는다), 최신순 정렬 `sort_articles`(`published_at` → `created_at` → 맨 뒤, 파싱 실패/naive에서 예외를 내지 않음), 태그 페이지 이름 배정 `assign_tag_filenames`(이름 오름차순, slug 충돌은 `-2`/`-3`), `render_tag_page`(`tags/` 안에서 쓰이므로 글 링크에 `../`를 붙이고, `relpaths`에 없는 글은 `KeyError`), `render_index`(피드 이름 오름차순 절 + 피드당 최근 20개 + 마지막 `## 태그` 절). 두 렌더 함수의 목록 줄은 `- [{제목}]({경로}) — {날짜}`이고 제목이 falsy면 `(제목 없음)`이다. 주제 페이지/인덱스 쓰기 층(T10b): `write_tag_pages(wiki_dir, articles) -> dict[str, Path]`가 글들의 태그를 모아 `tags/` 아래에 페이지를 쓰고(태그가 0개면 폴더를 만들지 않는다, 기존 `tags/*.md`는 지우지 않는다), `write_index(wiki_dir, articles) -> Path`가 루트 `index.md`를 쓴다. 둘 다 태그 파일 이름을 각자 `assign_tag_filenames`로 구한다(결정적이므로 일치가 보장된다) |
| `rss_wiki/pipeline.py` | 수집 → 추출 → 요약 → 위키 순서 조율, 실행당 요약 상한, 실패 정책 적용, 집계. 추출 단계(`prepare_body`)는 글 하나 단위로 원문 요청/`choose_body`/저장/실패 기록을 하며 fetch/extract 함수를 인자로 주입받는다(재시도 시 저장된 평문 본문이 피드 content 자리로 쓰임, 자체 결정). 수집 단계(`collect`)는 설정에 있는 피드만 돌며 `FeedFetchError`/`FeedParseError`/`sqlite3.Error`를 피드 단위 실패로 기록하고 다음 피드로 넘어간다. 연속 실패가 `GIVE_UP_THRESHOLD` 이상인 피드는 fetch 없이 건너뛰고 `CollectResult.given_up_feeds`로 센다. fetch 함수와 현재 시각 함수는 인자로 주입받고 현재 시각은 피드마다 한 번만 부른다. 실패 기록 경로 자체에서 난 `sqlite3.Error`는 DB 장애로 보고 잡지 않는다(실행 전체 실패, 자체 결정). 요약 단계(`summarize_article`)는 글 하나 단위로 `prepare_body` → 기존 태그 조회 → `summarize` 주입 호출 → `save_summary`를 하며, `SummaryError`만 글 실패로 기록하고 `ClaudeUnavailableError`와 그 밖의 예외는 올린다. 위키 단계(`write_wiki`, T9c)는 `db.SummarizedArticle`을 `wiki.WikiArticle`로 옮기고(피드 이름이 falsy면 `feed_url`로 대체) 쓴 글 파일 수를 돌려준다. 조회/쓰기 콜러블은 모두 인자로 주입받고 목록 순서에 의존하지 않는다. T10b에서 같은 단계가 같은 `WikiArticle` 목록으로 `write_tag_pages`와 `write_index`를 이어 부르도록 확장됐고, 반환값은 글 파일 수 그대로다(자체 결정). 요약 루프(`summarize_pending`, T11a)는 `list_pending_articles(conn, max_summaries)`를 한 번만 조회해 그 목록만 돌고, 요약할 글이 1개 이상일 때만 `check_claude`를 실행당 1회 부른 뒤 글마다 `summarize_article`을 불러 성공/실패를 센다. `max_summaries`가 0 이하면 조회도 `check`도 하지 않는다. 포기 수는 루프 전후 `count_given_up_articles` 차이(이번 실행의 델타)다. `ClaudeUnavailableError`는 잡지 않고 올려 실행을 멈춘다 |

테스트는 `tests/` 아래 모듈별 파일로 둔다. 네트워크와 `claude` 호출은 테스트에서 가짜로 대체한다. 오류 테스트는 `match=`로 원인을 구분한다.

## 마일스톤

### M1. 프로젝트 기반
- [x] 의존성과 CLI 골격 (T1)
- [x] CLI 테스트 보강, 디스패치 정리, README (T1b)
- [x] `feeds.yaml` 로더, `wiki_dir`/`db_path` 설정 키 포함 (T2)
- [x] 설정 로더 테스트 보강과 url 공백 처리 (T2b, T2 REVIEW 메모 1/2)
- [x] SQLite 스키마(PRD 5절의 테이블) 생성 (T3)
- [x] DB 테스트 정리(연결 종료, match, 재호출 데이터 유지, 기본값/제약) (T3b, T3 REVIEW 메모 2)
- [x] 설정 로더 오류 메시지 구분과 남은 오류 분기 테스트 (T2c, T2b REVIEW 메모 1/5)
- [x] 시각 헬퍼, `created_at` 기본값 제거, `PRAGMA user_version = 1`, pytest 경고를 오류로 (T3c, T3b REVIEW 메모 2/3/4)
- [x] `user_version` 하향 방지, 윤초 처리, DB/시각 테스트 정리 (T3d, T3c REVIEW 메모 1~4)

### M2. 수집
- [x] RSS 2.0 / Atom 파싱, 식별 키(`guid`/`id` → `link`), TZ fixture를 `tests/conftest.py`로 통합 (T4a, T3d REVIEW 메모 1/4)
- [x] 파싱 보정: 빈 응답/HTML 거절, http(s) 아닌 link 제거, 누락 분기 테스트 (T4a2, T4a REVIEW 메모 1/2/3)
- [x] `skipped_keys` 테이블과 `SCHEMA_VERSION` 2, 첫 수집 피드는 최근 10개만 등록하고 나머지 키는 `skipped_keys`에 기록 (T4b, T3d REVIEW 메모 2/3)
- [x] `register_entries` 실패 시 롤백, `published_at` 계약(파싱 불가/naive는 뒤로), 등록 테스트 보강 (T4b2, T4b REVIEW 메모 1/2/3)
- [x] 등록 테스트 보강: 부분 삽입 롤백, 정확한 집합 단언, 원본 문자열 저장 (T4b3, T4b2 REVIEW 메모 1/2)
- [x] 피드 HTTP 요청(`fetch_feed`, 타임아웃 30초, `FeedFetchError`), 상대 link를 응답 최종 URL 기준으로 절대화/스킴 대소문자 무관 비교, fetch 테스트 match 구분 (T4c, T4a2 REVIEW 메모 1/2)
- [x] `httpx.InvalidURL`을 `FeedFetchError`로 변환, 기본 client 경로(타임아웃/UA/리다이렉트/close) 테스트 (T4c2, T4c REVIEW 메모 1~4)
- [x] 수집 단계 조율(`pipeline.collect`): 설정에서 빠진 피드 제외, 기존 글 건너뛰기(`register_entries` 재사용), 피드 성공/실패 기록(`register_entries` 호출 뒤 별도 커밋, 등록 예외는 `sqlite3.Error` 기준), 상대 `Location` 리다이렉트 테스트 (T5, T4b2 REVIEW 메모 3, T4b3 REVIEW 메모 2, T4c2 REVIEW 메모 1/3)
- [x] 수집 테스트 보강: now 1회 사용, 새 글 0개 성공 기록, (c) 등록 단언, 등록 테스트 단언 정리 (T5c, T5 REVIEW 메모 1/2, T5b 흡수)

### M3. 본문 추출과 요약
- [x] trafilatura 추출, 짧거나(200자 미만, 자체 결정) 실패 시 피드 content/summary 대체, 요약 입력 20,000자 자르기 (T6, 순수 함수와 원문 요청)
- [x] 피드 content 텍스트화 보정(블록 경계 줄바꿈, script/style 제외, 공백 경계, 3xx/`__cause__` 테스트, docstring) (T6c, T6 REVIEW 메모 1~4)
- [x] 텍스트화 꼬리 유실 수정(`parser.close()`), 블록 태그 확장(`td`/`th`/`section`/`article`/`header`/`footer`/`figure`/`figcaption`/`hr`/`dt`/`dd`), CRLF 정규화 (T6d, T6c REVIEW 메모 1~4)
- [x] 텍스트화 테스트 보강: 단독 CR, 블록 태그 고정 목록 스냅샷과 파라미터화 (T6e, T6d REVIEW 메모 1/2)
- [x] 추출 단계 조율: `list_pending_articles`(pending/failed), 글 하나의 `prepare_body`(원문 요청 실패는 피드 content로 대체, 전체 본문 저장, 본문 없음은 글 실패), `record_article_failure` (T6b)
- [x] 본문 준비 테스트 보강: 재시도 성공 시 상태 불변, 콜러블 인자 단언, 실패 메시지 부정 단언 (T6f, T6b REVIEW 메모 1/2/3)
- [x] 프롬프트 생성(20,000자 자르기, 기존 태그 주입), JSON 출력 검증(`summary` 3개, `key_points`, `tags`), 태그 정규화(소문자화/공백 정리/공백→`-`) (T7a)
- [x] `claude` 설치/로그인 사전 확인(실패 시 글 실패와 구분되는 `ClaudeUnavailableError`), `claude -p` 호출(stdin, 타임아웃 180초, 모델 미지정), 호출 실패/형식 오류는 `SummaryError`, 요약 테스트 보강과 docstring (T7b, T7a REVIEW 메모 1~5)
- [x] 호출 테스트 보강(`check=False`, 리터럴 180, 기본 `which`, `PermissionError`, stderr 하한, "180초")과 `UnicodeDecodeError` → `SummaryCallError` (T7b2, T7b REVIEW 메모 1~4)
- [x] 요약/태그 저장(`save_summary` 한 트랜잭션)과 기존 태그 조회, 글 하나 요약 조율(`summarize_article`), `summarized` 전환, 저장된 평문 본문 재시도 경로 테스트, `check_claude`의 `which` 인자 단언 (T7c, T6f REVIEW 메모 1, T7b2 REVIEW 메모 1)
- [x] 글 실패 3회(`GIVE_UP_THRESHOLD`)에서 `given_up` 전환, 요약 성공 시 `failure_count`/`last_error` 초기화, README에 포기 해제 방법 (T8a, T7c REVIEW 메모 1/2/3)
- [x] 피드 연속 실패 3회 건너뛰기와 포기 수 집계(스키마 변경 없이 `consecutive_failures` 기준, `get_feed_failures` + `CollectResult.given_up_feeds`), 실패 기록 경로의 `sqlite3.Error`는 올린다는 의도 고정, now 1회 사용 테스트를 피드 2개로 확장, README 해제 절을 글/피드 양쪽으로 확장 (T8b, T5 REVIEW 메모 3, T5c REVIEW 메모 2, T8a REVIEW 메모 4)

### M4. 위키 생성
- [x] `get_feed_failures`의 조회 전용 계약(행을 만들지 않음)과 포기 피드의 `last_error` 불변을 테스트로 고정 (T8c, T8b REVIEW 메모 1, 테스트만)
- [x] `wiki.py` 순수 함수: `WikiArticle`, slug, 날짜 선택, 결정적 파일 이름 배정, 글 마크다운 렌더 (T9a, DB/파일 시스템 무관)
- [x] 파일 이름 중복 수정(배정된 이름 집합 기준)과 렌더 계약 단언 3건(frontmatter 키 순서 / 끝 개행 / 절 제목) (T9a2, T9a REVIEW 메모 1/2)
- [x] 요약 완료 글 조회(`db.list_summarized_articles`)와 피드별 폴더에 글 파일 쓰기(`wiki.write_article_files`), `render_article`의 절 순서/절-내용 대응 단언 (T9b, T9a2 REVIEW 메모 1/2)
- [x] `pipeline.write_wiki`가 `SummarizedArticle`을 `WikiArticle`로 옮겨(피드 이름 falsy면 `feed_url`) 위키 폴더에 쓰는 조율 단계, 목록 순서 무의존 고정 (T9c, T9b REVIEW 메모 1/2)
- [x] 주제 페이지/인덱스 순수 층: `article_relpaths`(`write_article_files`와 공유), `sort_articles`(파싱 실패/naive 방어), `assign_tag_filenames`, `render_tag_page`, `render_index` (T10a, T9c REVIEW 메모 1/2/3)
- [x] 두 렌더 함수의 관찰 가능성: 줄 모양 전체 비교, `## 태그` 절의 마지막 위치, `relpaths` 누락 시 `KeyError`, 인덱스의 falsy 제목 대체 (T10a2, T10a REVIEW 메모 1/2/3 필수 + 메모 4, 테스트만)
- [x] 주제 페이지/인덱스 파일 쓰기(`write_tag_pages`, `write_index`)와 `pipeline.write_wiki` 확장, 낡은 주제 페이지는 남김, 기존 `KeyError` 테스트에 `match=` (T10b, T10a2 REVIEW 메모 1 필수 + 메모 2)
- [x] 태그 페이지 링크의 글 파일 이름 충돌 케이스와 태그 공유 시 파일 이름을 리터럴로 고정 (T10c, T10b REVIEW 메모 1/2 필수, 테스트만)

### M5. 통합
- [x] 요약 루프(`pipeline.summarize_pending`): 실행당 상한, `check_claude` 1회, 성공/실패/포기 델타 집계, `ClaudeUnavailableError` 전파, `db.count_given_up_articles` (T11a, PRD 4.4 상한 / 7절)
- [x] `rss-wiki run` 전체 연결(수집 → 요약 루프 → 위키), `--config`/`--max-summaries`(기본 20), `ConfigError`/`SchemaVersionError`/`ClaudeUnavailableError` → 종료 코드 1, 여섯 줄 결과 출력, README/`pyproject.toml` 갱신, `list_articles` 호출 횟수 단언(T11a REVIEW 메모 1) (T11b, PRD 4.6)
- T11b에 흡수된 과거 메모: CLI 출력 테스트 보강(`run --help` description, `main([])` usage)과 `func` 누락 방어, `pyproject.toml` description 교체(T1b), README `feeds.yaml` 준비 단계(T2 메모 3), README `claude` 전제와 사전 확인이 짧은 프롬프트 1회를 소모하는 점(T7b 메모 5), `CollectResult` 세 필드 출력과 포기 수가 0이 아닐 때 README 해제 절 안내 한 줄(T8b 메모 5), config 테스트에 `url:`(값 null) 경우(T2c 메모 2)
- T11a에 흡수된 과거 메모: 요약 실패(`SummaryCallError`) 3회에서 글이 `given_up`이 되는지 루프 테스트로 고정(T8a 메모 3), 루프가 `ClaudeUnavailableError`를 삼키지 않는지 고정(T7c 메모 4)

## 미해결 의사결정

(없음)

- 이전 11건은 2026-09-18 PRD에 반영 완료(마지막: `first-run-skipped-keys` 합의 B).
