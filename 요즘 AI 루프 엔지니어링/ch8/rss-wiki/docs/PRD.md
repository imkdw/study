# RSS Wiki - PRD

> 작성일: 2026-09-12
> 상태: v1 스코프 확정

---

## 1. 한 줄 정의

RSS 리더에 LLM을 붙여서, 매일 쏟아지는 개별 글을 읽는 대신 **주제별로 누적 정리된 위키 페이지**를 읽게 하는 도구.

## 2. 문제

- 구독한 피드에서 매일 30개 안팎의 글이 쌓인다.
- 대부분은 같은 주제의 반복이거나 조각난 정보다.
- 글 단위로 읽으면 맥락이 안 쌓이고, 안 읽으면 미읽음만 쌓인다.

## 3. 목표

매일 30개의 글을 읽는 대신, **10개 내외의 잘 정리된 주제 페이지**를 제공한다.

### 성공 기준 (v1)

| 지표 | 목표 |
|---|---|
| 하루 수집 글 대비 주제 페이지 수 | 30개 글 -> 10개 이하 페이지 |
| 주제 페이지 "이번 주" 섹션 읽는 시간 | 페이지당 30초 이내 |
| 수집 파이프라인 성공률 | 글 단위 95% 이상 |
| 카테고리 분류 체감 정확도 | 오분류 10% 이하 (수동 샘플 점검) |
| 하루 LLM 비용 | $0.5 이하 |

### 비목표 (v1에서 안 함)

- 멀티 유저 / 계정 / 인증
- 모바일 앱
- 읽음 표시, 북마크, 개인화 추천
- 원문 전문 재배포
- 실시간 수집 (푸시, WebSub)

---

## 4. 확정된 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| UI | 정적 사이트 + 로컬 모드에서 수집 트리거 | 읽기는 정적 HTML. 로컬 실행 시에만 "수집하기" 버튼과 진행 상황 표시 |
| LLM 실행 | `claude -p` 서브프로세스, 워커 풀 병렬 | 별도 API 키 관리 없이 로컬 Claude Code 구독 사용 |
| 수집 실행 | 백그라운드 잡 + 상태 폴링 | 버튼 누르고 기다리지 않아도 됨. 요청/응답이 수집 시간에 묶이지 않음 |
| 카테고리 | 하이브리드 (시드 목록 + LLM 신규 제안) | 드리프트 방지와 확장성의 균형 |
| 위키 갱신 | 섹션 증분 + 주기적 전체 재작성 | 비용과 품질의 균형 |
| 스택 | TypeScript + SQLite + cron | ch6에서 SQLite 전환한 흐름 연장 |
| 본문 수집 | 조건부 (RSS content 짧을 때만 원문 fetch) | 품질 확보하면서 차단 위험 최소화 |
| 실패 정책 | 단계별 재시도 + dead-letter 격리 | 글 하나가 전체 사이클을 막지 않게 |
| 검색 | SQLite FTS5 + 정적 사이트용 JSON 인덱스 | 이미 SQLite를 쓰므로 추가 비용 거의 없음 |
| 중복 처리 | URL 정규화 + 제목 유사도 클러스터링 | 같은 소식의 다른 매체 기사를 한 항목으로 |
| 페이지 구성 | 이번 주 요약 / 지금까지의 흐름 / 타임라인 | 30초 훑기와 깊게 파기를 동시에 |
| 아카이빙 | 타임라인 최근 30개 컷 + 연도별 아카이브 파일 | 페이지 비대화 방지, 과거 기록 보존 |
| 언어 | 요약은 무조건 한국어 (원문 제목/링크는 유지) | 페이지 안에서 한/영 섞임 방지 |

---

## 5. 기능 요구사항

### 5.1 피드 구독 및 수집

- `config/feeds.yaml`에 피드 목록을 선언한다.
  ```yaml
  feeds:
    - url: https://example.com/feed.xml
      name: Example Blog
      seed_categories: [llm, infra]   # 선택. 분류 힌트로만 사용
      enabled: true
  ```
- RSS 2.0 / Atom / JSON Feed를 파싱한다.
- 피드별로 `etag` / `last-modified`를 저장해 조건부 요청(304)을 보낸다.
- 수집 주기: 하루 1회 (기본 07:00 KST). cron 또는 GitHub Actions 스케줄.
- 최초 수집 시 백필 한도: 피드당 최근 20개까지만 (초기 폭발 방지).

### 5.2 본문 추출 (조건부)

1. RSS의 `content:encoded` / `content`가 1,000자 이상이면 그대로 사용한다.
2. 미달이면 원문 URL을 fetch해서 본문을 추출한다 (Readability 계열).
3. 안전장치:
   - 도메인별 rate limit (기본 1 req/sec)
   - `robots.txt` 존중
   - User-Agent에 프로젝트 식별자 명시
   - 타임아웃 10초, 본문 상한 50,000자 (초과 시 절삭)
4. fetch 실패 시 RSS 요약본으로 폴백하고 `content_source = 'rss_fallback'`로 표시한다.

### 5.3 중복 제거

1. **URL 정규화**: 스킴/호스트 소문자화, 트레일링 슬래시 제거, `utm_*` / `fbclid` / `ref` 등 추적 쿼리 제거, 프래그먼트 제거.
2. 정규화 URL 해시가 같으면 동일 글로 본다.
3. **제목 유사도**: 같은 수집 사이클 내에서 정규화 제목(공백/기호 제거, 소문자화)의 유사도가 임계치(기본 0.85) 이상이면 하나의 클러스터로 묶는다.
4. 클러스터는 위키에 **한 항목**으로 쓰고, 출처는 여러 개 나열한다.
5. 주기적 재작성 단계에서 LLM이 남은 중복을 한 번 더 병합한다.

### 5.4 LLM 요약 및 분류

글 하나당 한 번의 호출로 다음을 구조화 출력(JSON)으로 받는다.

- `summary_ko`: 한국어 3~5문장 요약
- `one_liner_ko`: 타임라인용 한 줄 (80자 이내)
- `category`: 시드 카테고리 중 하나, 또는 신규 제안
- `is_new_category`: boolean
- `confidence`: 0~1
- `key_points`: 3개 이내 핵심 포인트
- `entities`: 제품/기업/기술 이름

규칙:
- 시드 카테고리 목록을 프롬프트에 항상 주입한다.
- 어디에도 안 맞으면 `is_new_category = true`로 신규 이름을 제안한다.
- 신규 제안 카테고리는 **바로 페이지를 만들지 않고** `pending_categories`에 쌓는다. 같은 이름이 3건 이상 누적되면 정식 카테고리로 승격하고 `feeds.yaml`에 기록한다. 그 전까지는 `misc`에 머문다.
- `confidence < 0.5`면 `misc`로 보내고 리뷰 큐에 표시한다.

### 5.5 위키 페이지 생성

**파일 구조**
```
docs/wiki/
  index.md               # 전체 주제 목록 + 이번 주 하이라이트
  llm-inference.md       # 주제 페이지
  ...
docs/wiki/archive/
  llm-inference-2026.md  # 연도별 아카이브
```

**주제 페이지 레이아웃**
```markdown
# LLM 추론 최적화

> 마지막 갱신: 2026-09-12 / 누적 항목 48개 / 구독 피드 5개

## 이번 주 (9/7~9/12)
- 핵심 3줄 (LLM 생성)

## 지금까지의 흐름
누적된 서술형 정리. 이 주제가 어디서 시작해 지금 어디 와 있는지.
주기적 재작성 단계에서 LLM이 통째로 다시 쓴다.

## 타임라인
- 2026-09-12 / 제목 / 한줄요약 [출처1] [출처2]
- 2026-09-10 / ...
(최근 30개. 이전은 아카이브 링크)

## 관련 주제
- [[vllm-serving]] / [[gpu-cost]]

## 출처
이 페이지에 기여한 피드 목록
```

**갱신 전략**
1. **증분 (매일)**: 새 글은 해당 페이지의 "타임라인" 최상단에 append하고 "이번 주" 섹션을 다시 생성한다. "지금까지의 흐름"은 건드리지 않는다.
2. **전체 재작성 (주 1회, 또는 해당 페이지에 신규 항목 10개 누적 시)**: LLM이 페이지 전체를 다시 쓴다. 중복 병합, "지금까지의 흐름" 갱신, 관련 주제 링크 재계산.
3. **아카이빙**: 타임라인이 30개를 넘으면 오래된 항목을 `archive/{slug}-{year}.md`로 이동한다. 이동 전에 해당 내용의 요지는 "지금까지의 흐름"에 흡수되어 있어야 한다.

**멱등성**: 같은 사이클을 두 번 돌려도 결과가 같아야 한다. 이미 `summarized` 상태인 글은 재요약하지 않고, 페이지 생성은 DB 상태로부터 결정적으로 파생된다.

### 5.6 검색

- SQLite FTS5 가상 테이블에 `title` / `summary_ko` / `key_points` / `entities`를 인덱싱한다.
- CLI: `rss-wiki search "vllm"` -> 매칭 글 + 소속 주제 페이지
- 정적 사이트: 빌드 시 `search-index.json`을 생성해 클라이언트 측에서 검색 (인덱스 1MB 초과 시 주제/요약만 포함하도록 축소).

### 5.7 정적 사이트

- `docs/wiki/*.md` -> HTML 빌드.
- 최소 기능: 사이드바 주제 목록, 본문, 검색 박스, 마지막 갱신 시각.
- 다크 모드 지원, 모바일 폭(400px)에서 깨지지 않을 것.
- 출력은 `dist/`. GitHub Pages 배포 가능.

**두 가지 모드**

| 모드 | 실행 | 수집 버튼 |
|---|---|---|
| 정적 배포 | `dist/`를 GitHub Pages 등에 올림 | 없음 (버튼 DOM 자체를 빌드에서 제외) |
| 로컬 | `rss-wiki serve` (기본 http://localhost:4321) | 있음 |

빌드 시 `window.__RSS_WIKI_MODE__`를 주입해 결정한다. 정적 배포본에서는 트리거 API가 아예 존재하지 않으므로 버튼이 노출될 일이 없다.

### 5.8 수집 트리거 및 백그라운드 잡

사이드바 상단에 **수집하기** 버튼을 둔다. 누르면 수집이 백그라운드에서 돌고, 페이지를 닫아도 계속 진행된다.

**동작 흐름**

1. 버튼 클릭 -> `POST /api/runs`
2. 서버는 잡을 `queued`로 등록하고 **즉시** `{ runId, status: "queued" }`를 반환한다 (요청을 수집 시간 동안 붙잡지 않는다).
3. 워커가 파이프라인(collect -> extract -> dedupe -> enrich -> compose -> build)을 순서대로 실행하며 단계별 진행률을 DB에 기록한다.
4. 클라이언트는 `GET /api/runs/:id/stream` (SSE)으로 진행 상황을 받는다. SSE 연결이 끊기면 `GET /api/runs/:id`를 2초 간격으로 폴링하는 방식으로 폴백한다.
5. 완료되면 사이트를 자동 새로고침하고 "새 글 12개 / 갱신된 주제 4개" 요약 토스트를 띄운다.

**API**

| 엔드포인트 | 설명 |
|---|---|
| `POST /api/runs` | 수집 시작. 이미 실행 중이면 409와 현재 runId를 반환 |
| `GET /api/runs/:id` | 단일 잡 상태 (폴링용) |
| `GET /api/runs/:id/stream` | SSE 진행 상황 스트림 |
| `POST /api/runs/:id/cancel` | 취소 요청 (협조적 취소) |
| `GET /api/runs?limit=10` | 최근 실행 이력 |

**진행 상황 페이로드**

```json
{
  "runId": "run_01J...",
  "status": "running",
  "stage": "enrich",
  "stages": {
    "collect":  { "status": "done",    "done": 5,  "total": 5 },
    "extract":  { "status": "done",    "done": 31, "total": 33 },
    "dedupe":   { "status": "done" },
    "enrich":   { "status": "running", "done": 12, "total": 31 },
    "compose":  { "status": "pending" },
    "build":    { "status": "pending" }
  },
  "startedAt": "2026-09-12T07:00:01Z",
  "elapsedMs": 48210,
  "errors": 2
}
```

**동시성 및 안전장치**

- 동시에 도는 수집 잡은 **1개**로 제한한다. 실행 중에 버튼을 또 누르면 새 잡을 만들지 않고 진행 중인 잡의 진행 상황을 보여준다.
- 잠금은 SQLite의 `jobs` 테이블 유니크 제약(`status IN ('queued','running')` 부분 인덱스)으로 건다. 프로세스가 비정상 종료된 경우를 대비해 `heartbeat_at`이 60초 이상 갱신되지 않은 잡은 `stale`로 판정하고 회수한다.
- 취소는 협조적 취소다. 각 단계 경계와 워커 루프에서 취소 플래그를 확인하고, 진행 중인 `claude -p` 자식 프로세스에는 SIGTERM을 보낸다. 이미 요약이 끝난 글은 롤백하지 않는다.
- cron 실행과 버튼 실행은 같은 잡 큐를 쓴다. cron이 도는 중에 버튼을 누르면 409와 함께 진행 중인 잡을 보여준다.
- 잡 로그는 `.rss-wiki/logs/{runId}.log`에 남기고, 실패 시 UI에서 마지막 50줄을 볼 수 있게 한다.

---

## 6. 실패 처리 정책

### 6.1 글 단위 상태 머신

```
discovered -> fetched -> summarized -> published
                  \-> failed(재시도) -> dead_letter
```

- 각 단계 실패 시 지수 백오프로 최대 3회 재시도 (1분 / 5분 / 25분, 다음 사이클로 넘어감).
- 3회 모두 실패하면 `dead_letter`로 격리하고 사이클은 계속 진행한다.
- `failed_reason`을 함께 저장한다 (`network` / `parse` / `llm_error` / `llm_refusal` / `timeout`).

### 6.2 피드 단위

- 피드가 연속 5회 실패하면 `unhealthy`로 표시하고 수집 주기를 1일 -> 7일로 늘린다.
- 연속 20회 실패하면 `disabled`로 전환하고 리포트에 남긴다. 자동 삭제는 하지 않는다.

### 6.3 LLM 단위

- 구조화 출력 파싱 실패 시 1회 재시도(온도 0), 그래도 실패하면 `dead_letter`.
- rate limit(429) 응답 시 백오프 후 재시도하며, 사이클 전체를 중단하지 않는다.
- 위키 페이지 재작성이 실패하면 **직전 버전 파일을 그대로 유지한다** (빈 페이지로 덮어쓰지 않음).

### 6.4 전역 가드

- 사이클당 최대 처리 글 수: 200개 (초과분은 다음 사이클로 이월).
- 하루 LLM 토큰 예산 초과 시 요약을 중단하고, 수집된 글은 `discovered` 상태로 남긴다.
- 모든 사이클은 `runs` 테이블에 시작/종료/처리량/실패수를 기록하고, 종료 시 콘솔 리포트를 출력한다.

---

## 7. 데이터 모델 (SQLite)

```sql
feeds(id, url, name, enabled, etag, last_modified,
      consecutive_failures, health, last_fetched_at)

articles(id, feed_id, guid, url, normalized_url, url_hash,
         title, author, published_at, raw_content, content_source,
         cluster_id, status, retry_count, failed_reason,
         created_at, updated_at)

summaries(article_id, summary_ko, one_liner_ko, key_points_json,
          entities_json, model, input_tokens, output_tokens, created_at)

categories(id, slug, name, is_seed, status, created_at)
  -- status: active | pending | merged

article_categories(article_id, category_id, confidence)

clusters(id, canonical_article_id, title_normalized, created_at)

pages(category_id, path, item_count, last_incremental_at,
      last_rewrite_at, items_since_rewrite)

runs(id, trigger, status, stage, started_at, finished_at,
     heartbeat_at, cancel_requested, feeds_ok, feeds_failed,
     articles_new, articles_failed, tokens_in, tokens_out, cost_usd)
  -- trigger: cron | manual
  -- status: queued | running | done | partial | failed | cancelled | stale

run_stages(run_id, stage, status, done, total, started_at, finished_at, error)

articles_fts(title, summary_ko, key_points, entities)  -- FTS5
```

**동시 실행 1개 제약**

```sql
CREATE UNIQUE INDEX one_active_run
  ON runs (status) WHERE status IN ('queued', 'running');
```

---

## 8. 아키텍처

```
 [cron]        [수집하기 버튼]
    |                |
    |          POST /api/runs (즉시 반환)
    \________________/
             |
             v
       잡 큐 (SQLite runs, 동시 1개)
             |
             v
         워커 프로세스
             |
  collect  -> RSS 파싱, 조건부 요청, 신규 글 판별
      |
  extract  -> 본문 확보 (RSS content 또는 원문 fetch)
      |
  dedupe   -> URL 정규화, 제목 유사도 클러스터링
      |
  enrich   -> claude -p 워커 풀 (동시 4)  ==== 병렬 ====
      |         |- worker 1 -> 글 A
      |         |- worker 2 -> 글 B
      |         |- worker 3 -> 글 C
      |         |- worker 4 -> 글 D
      |
  compose  -> 주제 페이지 증분 갱신 / 주기적 재작성(동시 2) / 아카이빙
      |
  build    -> 정적 HTML + search-index.json
             |
             v
       SSE 진행 상황 -> 브라우저
```

각 단계는 독립 실행 가능한 CLI 서브커맨드로 만든다. 파이프라인이 중간에 죽어도 그 단계부터 재개할 수 있어야 한다.

```
rss-wiki collect
rss-wiki enrich [--concurrency 4]
rss-wiki compose [--rewrite-all]
rss-wiki build
rss-wiki run          # 전체 파이프라인 (cron이 호출)
rss-wiki serve        # 로컬 웹 UI + 수집 트리거 API
rss-wiki search <q>
rss-wiki feeds add|list|disable
rss-wiki doctor       # claude CLI 확인, dead_letter, unhealthy feed, pending category, stale job
```

**프로세스 구조**: `serve`는 HTTP 서버와 워커를 같은 프로세스에서 돌린다. 워커는 이벤트 루프를 막지 않게 `claude -p`를 자식 프로세스로 띄우고 `await`할 뿐이므로 별도 프로세스 분리는 v1에서 하지 않는다.

---

## 9. LLM 사용 정책

### 9.1 실행 방식: `claude -p` 서브프로세스

API 키를 따로 관리하지 않고 로컬에 설치된 Claude Code CLI를 `claude -p`(비대화형 print 모드)로 호출한다.

```
claude -p <prompt> \
  --model <model> \
  --output-format json \
  --allowed-tools "" \
  --max-turns 1
```

- `--allowed-tools ""`로 도구 사용을 막는다. 요약/분류는 순수 텍스트 변환이므로 파일 접근이나 웹 접근이 필요 없다.
- `--max-turns 1`로 에이전트 루프를 차단한다.
- 프롬프트는 argv가 아니라 **stdin으로 전달**한다 (본문이 길고, 셸 이스케이프 문제를 피하기 위해).
- 출력은 `--output-format json`으로 받아 파싱하고, 그 안의 결과 텍스트에서 JSON 블록을 추출한다. 파싱 실패 시 1회 재시도 후 `dead_letter`.
- `claude` 실행 파일 경로와 사용 가능 여부는 시작 시 `rss-wiki doctor`에서 검증한다.

| 용도 | 모델 | 이유 |
|---|---|---|
| 글 요약 + 분류 | `claude-haiku-4-5` | 건당 호출이 많음. 속도 우선 |
| 페이지 전체 재작성 | `claude-sonnet-5` | 주 1회 수준. 서술 품질이 중요 |

### 9.2 병렬 처리

`enrich` 단계는 글 하나당 한 번의 독립 호출이라 병렬화 이득이 가장 크다. 워커 풀로 처리한다.

- **동시 실행 수**: 기본 4. `llm.concurrency` 설정으로 조정하며 상한은 8로 막는다.
- **워커 풀 방식**: 고정 크기 큐 소비자. 한 워커가 끝나면 즉시 다음 글을 집는다. 배치 단위로 나눠서 `Promise.all`로 기다리는 방식은 쓰지 않는다 (느린 하나가 전체를 막음).
- **글 단위 격리**: 워커 하나가 실패해도 다른 워커는 계속 돈다. 실패한 글만 재시도 큐로 간다.
- **호출당 타임아웃** 120초. 초과 시 자식 프로세스에 SIGTERM, 5초 후에도 살아 있으면 SIGKILL.
- **결과 기록**: 각 호출이 끝날 때마다 개별 트랜잭션으로 DB에 쓴다. 중간에 죽어도 이미 끝난 요약은 보존된다.

**레이트 리밋 대응**

- `claude -p`가 429 또는 usage limit을 반환하면 해당 워커는 지수 백오프로 대기했다가 재시도한다.
- 연속 3회 레이트 리밋이 걸리면 풀 전체의 동시 실행 수를 절반으로 줄인다(4 -> 2 -> 1). 5분간 성공이 이어지면 원복한다.
- 사용량 한도 소진 메시지를 받으면 `enrich`를 중단하고 남은 글은 `discovered` 상태로 남긴다. 잡은 `partial` 상태로 끝나고, 이미 요약된 글로 위키 빌드까지는 진행한다.

**진행 상황 반영**: 워커가 글 하나를 끝낼 때마다 `enrich.done`을 증가시켜 SSE로 내보낸다. 사용자는 "12 / 31 요약 완료"를 실시간으로 본다.

**재작성 단계 병렬화**: `compose --rewrite`도 페이지 단위로 독립적이므로 같은 워커 풀 패턴을 쓰되, 문서 품질 호출이라 동시 실행 수는 2로 더 낮게 둔다.

### 9.3 공통

- 모든 호출은 JSON schema를 프롬프트에 명시하고 결과를 스키마로 검증한다.
- 시드 카테고리 목록과 페이지 스타일 가이드는 프롬프트 앞부분에 고정 배치해 캐시가 걸리게 한다.
- 호출마다 소요 시간/토큰/비용을 `summaries` / `runs`에 기록한다.
- 모델 ID는 config로 빼서 교체 가능하게 한다.

---

## 10. 저작권 / 예의

- 원문 전문을 위키에 그대로 싣지 않는다. 요약만 싣고 원문 링크를 반드시 병기한다.
- 모든 항목에 출처 매체명과 원문 URL을 표기한다.
- 원문 fetch는 rate limit과 robots.txt를 지킨다.
- 이 도구는 개인 사용을 전제로 한다. 공개 배포 시 피드 제공자의 라이선스를 각자 확인한다.

---

## 11. 설정 파일 예시

```yaml
# config/rss-wiki.yaml
schedule: "0 7 * * *"
timezone: Asia/Seoul

collect:
  backfill_limit: 20
  max_articles_per_run: 200

extract:
  rss_content_min_length: 1000
  fetch_timeout_ms: 10000
  rate_limit_per_domain_rps: 1
  max_content_chars: 50000

dedupe:
  title_similarity_threshold: 0.85
  strip_query_params: [utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, ref, ref_src]

llm:
  runner: claude-cli            # claude -p 서브프로세스
  claude_bin: claude            # PATH에서 찾음. 절대경로 지정 가능
  summarize_model: claude-haiku-4-5
  rewrite_model: claude-sonnet-5
  concurrency: 4                # enrich 동시 실행 수 (상한 8)
  rewrite_concurrency: 2
  call_timeout_ms: 120000
  backoff_on_rate_limit_ms: [5000, 20000, 60000]
  daily_budget_usd: 0.5
  language: ko

server:
  port: 4321
  host: 127.0.0.1
  enable_manual_run: true       # "수집하기" 버튼 노출 여부
  stale_job_timeout_ms: 60000   # heartbeat 끊긴 잡 회수 기준

categories:
  seeds: [llm, infra, frontend, database, career, security]
  promote_after: 3          # pending 카테고리 승격 임계치
  low_confidence_threshold: 0.5

compose:
  timeline_limit: 30
  rewrite_every_days: 7
  rewrite_after_n_items: 10

retry:
  max_attempts: 3
  backoff_ms: [60000, 300000, 1500000]
  feed_unhealthy_after: 5
  feed_disable_after: 20
```

---

## 12. 마일스톤

| 단계 | 범위 | 완료 기준 |
|---|---|---|
| M1 | collect + SQLite 스키마 | 피드 3개에서 글이 DB에 쌓임. 중복 없음 |
| M2 | extract + dedupe | 본문 확보율 90% 이상, 클러스터링 동작 |
| M3 | enrich (`claude -p` 워커 풀) | 글 30개가 동시 4로 처리됨. 직렬 대비 2.5배 이상 단축, 하나 실패해도 나머지 완료 |
| M4 | compose (증분 + 재작성 + 아카이브) | 주제 페이지 마크다운이 생성되고 재실행해도 동일 |
| M5 | build + search | 정적 사이트가 뜨고 검색이 동작 |
| M6 | serve + 수집 트리거 | 버튼 클릭 후 응답 200ms 이내, 탭을 닫아도 수집 완료. 진행률이 실시간으로 보임 |
| M7 | 운영 (cron, doctor, 예산 가드, stale 회수) | 일주일 무인 운영 후 dead_letter 5% 이하 |

---

## 13. 열린 질문 (v1 이후)

- 주제 간 관련도를 무엇으로 계산할 것인가 (현재는 LLM 판단. 임베딩 도입 여부)
- 카테고리 병합/분할을 사람이 개입하는 UX가 필요한가
- 뉴스레터 형태의 일간 다이제스트 발송을 붙일 것인가
- 피드 외 소스(GitHub 릴리스, 유튜브, X) 확장
