# rss-wiki QA 테스트 케이스 + E2E 실행 결과

> 실행일: 2026-09-12 (1차 QA) / 2026-09-12 (수정 후 재검증)
> 대상: rss-wiki v1.0.0 (main, 6233db7)
> 방식: 실제 개발 RSS 피드로 전체 파이프라인 E2E + CLI/HTTP API 블랙박스 검증
> 실행 환경: Node v24.17.0 / claude 2.1.269 / macOS 25.6.0

---

## 1. 요약

| 구분 | 1차 QA | 수정 후 재검증 |
|---|---|---|
| 단위 테스트 | 154 pass / 0 fail | 168 pass / 0 fail (회귀 13건 추가) |
| 타입 체크 | 통과 | 통과 |
| E2E 테스트 케이스 | 60건 / PASS 45, FAIL 13 | 60건 / PASS 59, FAIL 0, 조건부 1 |
| 자동화 스크립트 | 32/32 PASS (LLM 미포함) | 36/36 (LLM 미포함) / 54/54 (LLM 포함) |
| 실제 수집 글 | 77건 (4개 피드, 3가지 포맷) | 누적 141건 |
| 실제 LLM 호출 | 요약 13건 / $0.4415 | 요약 18건 + 재작성 10건 / 누적 약 $1.1 |

### 수정 결과

결함 13건 중 12건을 고쳤고, 1건(D12)은 코드로 막을 수 있는 부분만 고치고 제품 결정이 남았다.

| ID | 심각도 | 상태 | 한 줄 요약 |
|---|---|---|---|
| D1 | High | 수정됨 | `createRewriteFn` 을 만들어 CLI/파이프라인의 compose 에 주입. 실제 LLM 으로 "지금까지의 흐름" 이 채워지는 것까지 확인 |
| D2 | High | 수정됨 | 예산/취소로 중단된 글은 상태와 `retry_count` 를 건드리지 않는다. 실측 11건이 `fetched` 로 보존됨 |
| D3 | Medium | 수정됨 | `cache_creation` / `cache_read` 를 입력 토큰에 합산. 항상 10 이던 값이 실측 28,010 으로 |
| D4 | Medium | 수정됨 | 초과분을 아카이브로 내보내고 본문 타임라인을 한도까지 절삭. 변경 없으면 0건 보고 |
| D5 | Medium | 수정됨 | 접두 검색(`"토큰"*`)으로 조사가 붙은 한국어 토큰도 매칭 |
| D6 | Low | 수정됨 | contentless FTS 대신 `summaries.summary_ko` 에서 질의어 주변을 잘라 스니펫 생성 |
| D7 | Medium | 수정됨 | 파이프라인이 취소 플래그를 1초 주기로 폴링. 반영까지 41초 -> 2.1초 |
| D8 | Low | 수정됨 | 피드 목록 경로 전용 `--feeds` 옵션 신설. `--config` 는 파이프라인 설정 전용 |
| D9 | Low | 수정됨 | "부분성공 false개" -> "(부분 완료) ... 예산/취소로 중단 N개" |
| D10 | Low | 수정됨 | `collect.fetch_timeout_ms` 분리. extract 타임아웃을 1ms 로 낮춰도 수집은 정상 |
| D11 | Medium | 수정됨 | `errors` 에 피드/글 실패 합산 + `errorBreakdown` 추가 |
| D13 | Medium | 수정됨 | `enrich` 가 끝날 때 FTS 를 재인덱싱. `build` 없이도 검색됨 |
| D12 | High | **부분 수정 / 결정 필요** | 예산 초과분(동시 실행 수만큼)은 선반영 검사로 막았고 `doctor` 가 하루 비용을 예측한다. 다만 호출당 고정 비용 자체는 `claude -p` 구조상 코드로 못 줄인다 |

### 남은 결정 사항 (D12)

`claude -p` 는 호출마다 Claude Code 시스템 프롬프트(실측 약 13K~21K 토큰)를 함께 태운다.
그래서 비용이 글 길이가 아니라 호출 횟수에 지배되고, 글 하나당 약 $0.039 가 고정으로 든다.
하루 30글이면 약 $1.17 로 PRD 의 $0.5 기준을 넘는다. 코드로 고를 수 있는 선택지는 셋이다.

1. 한 호출에 글 여러 개를 묶는다. 비용은 거의 배수만큼 내려가지만 PRD 5.4 의 "글 하나당 한 번의 호출" 과 글 단위 실패 격리를 바꿔야 한다.
2. 요약만 Claude API 직접 호출로 바꾼다. 시스템 프롬프트 오버헤드가 사라지지만 API 키 관리가 생긴다 (PRD 4절의 결정을 뒤집는다).
3. 예산 기본값을 실측에 맞춰 올리고 하루 처리량을 줄인다. 코드 변경 없음.

셋 다 제품 결정이라 QA 단계에서 임의로 정하지 않았다.

---

## 2. 테스트 데이터

실제 개발 관련 RSS 를 사용했다. 세 가지 피드 포맷을 모두 덮는다.

| 피드 | 포맷 | 시드 카테고리 | 용도 |
|---|---|---|---|
| https://simonwillison.net/atom/everything/ | Atom | llm | 정상 수집 / LLM 주제 |
| https://blog.cloudflare.com/rss/ | RSS 2.0 | infra, security | 정상 수집 / 인프라 주제 |
| https://www.postgresql.org/news.rss | RSS 2.0 | database | 정상 수집 / DB 주제 |
| https://blog.jim-nielsen.com/feed.json | JSON Feed | frontend | JSON Feed 파서 검증 |
| https://jsonfeed.org/feed.json | (404) | - | 피드 실패/헬스 전이 음성 케이스 |
| https://simonwillison.net/atom/everything/?utm_source=qa | Atom | llm | URL 정규화 기반 중복 제거 검증 |

샌드박스 4개를 분리해 서로 다른 설정으로 돌렸다. 저장소 작업 트리는 건드리지 않는다.

| 샌드박스 | 설정 포인트 | 검증 대상 |
|---|---|---|
| qa | backfill 2, 예산 $0.5, port 4399 | 정상 전 구간 + 서버 API |
| qa2 | backfill 20, 강제 원문 fetch, 예산 $0.0001, port 4400 | 취소 / 예산 가드 |
| qa3 | qa2 복제, port 4401 | 크래시 후 stale 회수 |
| qa4 | fetch_timeout 1ms, max_content_chars 800 | rss_fallback / 절삭 / URL 중복 |
| qa5 | qa 복제, timeline_limit 2 | 아카이빙 / feeds 서브커맨드 |

---

## 3. 테스트 케이스

표기: PASS 통과 / FAIL 미통과 / N/A 이번 회차에 조건 미발생 / INFO 참고.

### 3.1 collect (PRD 5.1, 6.2)

| ID | 케이스 | 절차 | 기대 결과 | 실제 | 판정 |
|---|---|---|---|---|---|
| TC-CO-01 | RSS 2.0 파싱 | qa 에서 `collect` | PostgreSQL News 글이 DB 에 적재 | 2건 적재 | PASS |
| TC-CO-02 | Atom 파싱 | 동상 | Simon Willison 글 적재 | 2건 적재 | PASS |
| TC-CO-03 | JSON Feed 파싱 | 동상 | Jim Nielsen 글 적재 | 2건 적재 | PASS |
| TC-CO-04 | 백필 한도 | `backfill_limit: 2` 로 최초 수집 | 피드당 2건까지만 | 4피드 x 2 = 8건 | PASS |
| TC-CO-05 | 조건부 요청 준비 | 수집 후 feeds 행 확인 | etag 또는 last_modified 저장 | 4개 피드 모두 저장 | PASS |
| TC-CO-06 | 재수집 멱등 | `collect` 2회 연속 | 두 번째 신규 0건, 총 8건 유지 | 신규 0건 / 총 8건 | PASS |
| TC-CO-07 | 피드 실패 격리 | 404 피드 포함 수집 | 나머지 피드는 정상 수집, 경고 로그 | 성공 4 / 실패 1 | PASS |
| TC-CO-08 | 헬스 전이 | 404 피드로 5회 수집 | 연속 5회 실패 시 unhealthy | cf=5, health=unhealthy | PASS |
| TC-CO-09 | 비활성 피드 제외 | `feeds disable` 후 수집 | 비활성 피드는 요청하지 않음 | enabled=0, 수집 대상 제외 | PASS |

### 3.2 extract (PRD 5.2)

| ID | 케이스 | 절차 | 기대 결과 | 실제 | 판정 |
|---|---|---|---|---|---|
| TC-EX-01 | RSS 본문 사용 | 기본 설정으로 `extract` | 1,000자 이상이면 원문 fetch 없이 사용 | 8건 중 7건 `content_source=rss` | PASS |
| TC-EX-02 | 조건부 원문 fetch | 동상 | 짧은 글만 원문 fetch | 1건 `content_source=fetched` | PASS |
| TC-EX-03 | fetch 실패 폴백 | qa4 `fetch_timeout_ms: 1` | 전부 `rss_fallback` | 5/5 rss_fallback | PASS |
| TC-EX-04 | 본문 상한 절삭 | qa4 `max_content_chars: 800` | 800자로 절삭 | 최대 길이 정확히 800 | PASS |
| TC-EX-05 | 도메인 rate limit | qa2 60건 원문 fetch | 도메인당 1rps 유지 | 60건 처리에 60초 이상 소요 | PASS |

### 3.3 dedupe (PRD 5.3)

| ID | 케이스 | 절차 | 기대 결과 | 실제 | 판정 |
|---|---|---|---|---|---|
| TC-DE-01 | URL 정규화 | qa4 수집 결과 확인 | 트레일링 슬래시/추적 쿼리 제거 | `.../openai-agents-rubygems` 형태로 저장 | PASS |
| TC-DE-02 | 동일 글 중복 제거 | 같은 피드를 URL 변형으로 2개 등록 | 글은 한 번만 적재 | 후보 10건 -> 적재 5건 | PASS |
| TC-DE-03 | 클러스터 생성 | qa `dedupe` | 글마다 cluster_id 부여 | 8건 / 8클러스터 | PASS |

### 3.4 enrich (PRD 5.4, 9.2, 6.4)

| ID | 케이스 | 절차 | 기대 결과 | 실제 | 판정 |
|---|---|---|---|---|---|
| TC-EN-01 | 워커 풀 병렬 | qa `enrich --concurrency 4` | 8건 전부 성공, 직렬 대비 단축 | 8/8 성공, 37.5초 | PASS |
| TC-EN-02 | 출력 스키마 | summaries 행 확인 | 한국어 요약/한줄/키포인트/엔티티 | 전 항목 한국어로 채워짐 | PASS |
| TC-EN-03 | 시드 카테고리 분류 | article_categories 확인 | 시드 중 하나 또는 misc | security 3 / database 2 / llm 1 / misc 2 | PASS |
| TC-EN-04 | 저신뢰 -> misc | confidence < 0.5 발생 시 | misc + 리뷰 큐 | 최저 0.75 로 조건 미발생 | N/A |
| TC-EN-05 | 예산 가드 | qa2 예산 $0.0001 로 run | enrich 중단, 잡은 partial, 위키/빌드는 진행 | status=partial, compose/build 완료 | PASS |
| TC-EN-06 | 중단 글 상태 보존 | 동상, articles 상태 확인 | 남은 글은 재시도 대상으로 보존 | 1차: 3건이 `failed`/retry_count=1 / 재검증: 11건이 `fetched`, retry_count=0 | FAIL -> PASS (D2) |
| TC-EN-07 | 토큰 집계 | summaries.input_tokens 확인 | 프롬프트 길이에 비례 | 1차: 항상 10 / 재검증: 28,010 | FAIL -> PASS (D3) |

### 3.5 compose (PRD 5.5)

| ID | 케이스 | 절차 | 기대 결과 | 실제 | 판정 |
|---|---|---|---|---|---|
| TC-CM-01 | 페이지 레이아웃 | qa `compose` 후 md 확인 | 이번 주 / 흐름 / 타임라인 / 관련 주제 / 출처 | 5개 섹션 모두 생성, 출처 링크 병기 | PASS |
| TC-CM-02 | index.md | 동상 | 주제 목록 + 이번 주 하이라이트 | 4주제 목록 + 하이라이트 생성 | PASS |
| TC-CM-03 | 증분 갱신 | 신규 글 있는 상태로 재실행 | 타임라인 최상단 append | 최신순 정렬 유지 | PASS |
| TC-CM-04 | 멱등성 | `compose` 2회 후 해시 비교 | 마크다운 바이트 동일 | docs/wiki/*.md 해시 동일 | PASS |
| TC-CM-05 | 아카이브 컷 | `timeline_limit` 을 낮춰 compose 2회 | 초과분을 아카이브로 이동, 본문 타임라인 절삭 | 재검증: 본문 2건으로 절삭 + 아카이브 링크, 2회차 아카이브 0건 | FAIL -> PASS (D4) |
| TC-CM-06 | 전체 재작성 | `compose --rewrite-all` | LLM 이 페이지 재작성, 흐름 갱신 | 재검증: 재작성 3건, 한국어 서술 + `[[llm]]` 관련 주제 생성 | FAIL -> PASS (D1) |

### 3.6 build / search (PRD 5.6, 5.7)

| ID | 케이스 | 절차 | 기대 결과 | 실제 | 판정 |
|---|---|---|---|---|---|
| TC-BS-01 | 정적 사이트 빌드 | qa `build --mode local` | dist 에 HTML/CSS/JS/인덱스 | 5페이지 + app.js + styles.css + search-index.json | PASS |
| TC-BS-02 | 로컬 모드 | 동상 | 수집 버튼 + `__RSS_WIKI_MODE__="local"` | 버튼 존재, 모드 주입 확인 | PASS |
| TC-BS-03 | 정적 모드 | `build --mode static` | 수집 버튼 DOM 제외 | "수집하기" 0회, 모드 "static" | PASS |
| TC-BS-04 | 검색 인덱스 | dist/search-index.json | 제목/요약 포함 JSON | 8,402바이트, 상한 이하라 미축소 | PASS |
| TC-BS-05 | 테마/반응형 | styles.css 확인 | 다크 모드 + 400px 대응 | `prefers-color-scheme: dark`, `max-width: 400px`/`700px` | PASS |
| TC-BS-06 | 검색 기본 | `search PostgreSQL` 등 6종 | 매칭 글 + 소속 주제 | 영문/숫자/한국어 단어 모두 정상, 주제 슬러그 동반 | PASS |
| TC-BS-07 | 검색 입력 방어 | `"unclosed`, `a OR`, `NEAR(` 등 | 크래시 없이 0건 | 전부 exit 0 / 0건 | PASS |
| TC-BS-08 | 한국어 조사 결합 | `search 마이그레이션` | 본문에 있는 단어가 검색됨 | 1차: 0건 / 재검증: 1건 | FAIL -> PASS (D5) |
| TC-BS-09 | 검색 스니펫 | 검색 결과 필드 | 매칭 문맥 스니펫 | 재검증: 질의어 주변 문맥이 채워짐 | FAIL -> PASS (D6) |
| TC-BS-10 | 인덱스 갱신 시점 | `enrich` 직후 `build` 없이 `search` | 요약된 글이 검색됨 | 1차: 0건 / 재검증: 매칭됨 | FAIL -> PASS (D13) |

### 3.7 serve / 잡 큐 (PRD 5.8)

| ID | 케이스 | 절차 | 기대 결과 | 실제 | 판정 |
|---|---|---|---|---|---|
| TC-SV-01 | 즉시 반환 | `POST /api/runs` | 202 + runId, 200ms 이내 | 202, 24ms | PASS |
| TC-SV-02 | 동시 1개 제한 | 실행 중 재요청 | 409 + 진행 중 runId | 409, 동일 runId | PASS |
| TC-SV-03 | 상태 폴링 | `GET /api/runs/:id` | PRD 진행 페이로드 스키마 | 6단계 status/done/total, startedAt, elapsedMs 일치 | PASS |
| TC-SV-04 | SSE | `GET /api/runs/:id/stream` | data 이벤트 + 종료 이벤트 | data 31건 + `event: done` | PASS |
| TC-SV-05 | 취소 최종 상태 | `POST /api/runs/:id/cancel` | 결국 cancelled | 202 수락 후 cancelled 도달 | PASS |
| TC-SV-06 | 취소 반응성 | extract 60건 중 취소 | 진행 중인 스테이지에서도 즉시 중단 | 1차: 41초 후 60/60 처리 뒤 반영 / 재검증: 2.1초, 12/60 에서 중단 | FAIL -> PASS (D7) |
| TC-SV-07 | 실행 이력 | `GET /api/runs?limit=5` | 최근 잡 배열 | 정상 배열 반환 | PASS |
| TC-SV-08 | 경로 탈출 | `/../../etc/passwd`, `%2e%2e` | 403/404 로 차단 | 404 / 403 | PASS |
| TC-SV-09 | stale 회수 | 실행 중 서버 SIGKILL 후 재기동 | 60초 뒤 stale 판정, 다음 트리거에서 회수 | doctor 가 stale 감지, 이후 POST 는 202 로 새 잡 생성 | PASS |
| TC-SV-10 | 실패 집계 노출 | 404 피드 포함 run 의 payload | 실패가 errors 로 드러남 | 1차: errors=0 / 재검증: errors=1, breakdown feeds=1 | FAIL -> PASS (D11) |

### 3.8 운영 / CLI (PRD 7, 8, TASKS M7)

| ID | 케이스 | 절차 | 기대 결과 | 실제 | 판정 |
|---|---|---|---|---|---|
| TC-OP-01 | doctor 정상 | 초기 상태에서 `doctor` | 문제 0건, exit 0 | claude CLI 정상 확인 포함 exit 0 | PASS |
| TC-OP-02 | doctor 문제 감지 | unhealthy 피드 있는 상태 | 문제 목록 + exit 1 | 불건전 피드 1건 보고, exit 1 | PASS |
| TC-OP-03 | feeds 관리 | `feeds add/list/disable` | 추가/목록/비활성 반영 | 정상, 중복 추가는 exit 1 | PASS |
| TC-OP-04 | 공통 옵션 일관성 | `feeds list --feeds <path>` / `--config` 분리 | `--config` 는 파이프라인 설정 경로 | 재검증: `--feeds` 로 목록 지정, `--config` 는 목록에 영향 없음 | FAIL -> PASS (D8) |
| TC-OP-05 | 종료 코드 | `bogus`, `search`(빈 질의), `help` | 1 / 1 / 0 | 1 / 1 / 0 | PASS |
| TC-OP-06 | enrich 출력 | `enrich` 표준 출력 | 사람이 읽을 수 있는 요약 | 재검증: "(부분 완료) ... 예산/취소로 중단 11개" | FAIL -> PASS (D9) |
| TC-OP-07 | 타임아웃 설정 출처 | `extract.fetch_timeout_ms: 1` 로 collect | 피드 수집은 영향 없음 | 재검증: 피드 4개 정상 수집, 신규 8건 | FAIL -> PASS (D10) |

### 3.9 비기능 (PRD 3 성공 기준)

| ID | 케이스 | 절차 | 기대 결과 | 실제 | 판정 |
|---|---|---|---|---|---|
| TC-NF-01 | 일일 LLM 비용 | 실측 비용 / 글 수 | 하루 30글에 $0.5 이하 | $0.0389/글 -> 30글 환산 $1.17. 초과분 선반영 차단과 doctor 경고는 적용, 구조 결정은 미정 | 조건부 (D12) |
| TC-NF-02 | 빌드 재현성 | `build` 2회 후 해시 비교 | - | HTML 은 "마지막 갱신" 타임스탬프 때문에 매번 달라짐 (md 는 동일) | INFO |
| TC-NF-03 | 회귀 스위트 | `pnpm test`, `pnpm typecheck` | 전부 통과 | 154 pass / 0 fail, 타입 오류 없음 | PASS |

---

## 4. 결함 상세

### D1 (High) 위키 전체 재작성이 프로덕션 경로에 연결되어 있지 않다 [수정됨]

- 현상: `rss-wiki compose --rewrite-all` 을 실행해도 "재작성 0개" 이고 LLM 비용이 0 이다. 주제 페이지의 "지금까지의 흐름" 과 "관련 주제" 가 영구히 `_아직 없음_` 으로 남는다.
- 원인: `compose()` 는 `opts.rewriteFn` 이 있을 때만 재작성한다 (`src/compose/index.ts:401`, `:412`). CLI 는 `{ rewriteAll: true }` 만 넘기고, 파이프라인은 `composeMod.compose(ctx)` 를 인자 없이 호출한다 (`src/jobs/pipeline.ts:44`). `src/llm/prompts.ts:80` 의 `rewritePagePrompt` 는 `src` 안에 호출부가 하나도 없다 (테스트에서만 스텁으로 주입).
- 영향: PRD 5.5 갱신 전략 2, 9.1 `rewrite_model`, TASKS T4.3 미충족. 제품의 핵심 가치("누적된 서술형 정리")가 동작하지 않는다.
- 재현: `node --experimental-strip-types src/cli.ts compose --rewrite-all` -> `재작성 0개`.
- 수정: `src/llm/rewriteRunner.ts` 의 `createRewriteFn` 이 `rewritePagePrompt` + `claudeRunner` + 예산 가드를 묶어 `RewriteFn` 을 만든다. CLI `compose` 와 `loadStageFns` 의 compose 가 이를 주입한다. 예산이 소진됐으면 `null` 을 돌려 증분 갱신만 한다.
- 재검증: 실제 `claude -p` 로 재작성 3건 성공. "지금까지의 흐름" 에 한국어 서술이 채워지고 "관련 주제" 에 `[[llm]] / [[infra]]` 가 생성됐다. 재작성 실패 시 직전 파일이 유지되는 동작(PRD 6.3)도 그대로다.

### D2 (High) 예산 초과/취소로 중단된 글이 실패로 기록된다 [수정됨]

- 현상: 예산 가드가 걸린 순간 진행 중이던 3건이 `status=failed`, `failed_reason=llm_error`, `retry_count=1` 로 기록됐다.
- 원인: 예산 초과 시 `budgetController.abort()` 로 진행 중인 `claude` 자식 프로세스를 죽이는데 (`src/enrich/index.ts:254-256`), 그 중단 오류가 `classify()` 에서 `llm_error` 로 분류돼 `markFailure()` 를 탄다 (`src/enrich/index.ts:90-95`, `:240`). 사용자 취소(`ctx.signal`)도 같은 경로다.
- 영향: PRD 9.2 "남은 글은 discovered 상태로 남긴다" 위반. 예산 초과가 3회 반복되면 정상 글이 `dead_letter` 로 격리된다 (`max_attempts: 3`). PRD 7절 M7 기준인 "dead_letter 5% 이하" 를 무관한 사유로 깨뜨린다.
- 재현: `llm.daily_budget_usd: 0.0001` 로 `run` 실행 후 `articles` 상태 조회.
- 수정: 워커가 호출 전후로 `combinedSignal.aborted` 를 확인해, 중단으로 생긴 오류는 `markFailure` 를 타지 않는다. 중단된 글 수는 `total - 성공 - 실패` 로 따로 집계해 `interrupted` 로 보고한다. 예산 검사도 "이미 쓴 비용 + 진행 중 호출의 예상 비용" 으로 선반영해서 동시 실행 수만큼 초과하던 것을 막는다.
- 재검증: 예산 $0.05 로 실제 실행 -> 성공 1건, 실패 0건, 중단 11건. 중단된 11건은 `fetched` 상태에 `retry_count=0` 으로 남았다. 지출은 $0.0368 로 한도 아래에서 멈췄다.

### D3 (Medium) 입력 토큰 집계가 실제 사용량을 반영하지 않는다 [수정됨]

- 현상: 본문 길이가 688자든 33,605자든 `summaries.input_tokens` 가 항상 10 이다. `runs.tokens_in` 도 같은 값이 누적된다.
- 원인: `claude -p --output-format json` 의 `usage.input_tokens` 만 읽는다 (`src/llm/claudeRunner.ts:96`). 실제 입력은 `cache_creation_input_tokens` / `cache_read_input_tokens` 에 들어간다 (실측: input 10 / cache_creation 13,371 / cache_read 13,607).
- 영향: PRD 9.3 "호출마다 토큰을 기록한다" 가 사실상 무효. 토큰 기반 분석/알림을 만들 수 없다. 비용(`total_cost_usd`)은 정상이라 예산 가드 자체는 동작한다.
- 수정: `totalInputTokens()` 로 세 값을 합산해 기록한다 (`src/llm/claudeRunner.ts`).
- 재검증: 같은 글 요약의 `input_tokens` 가 10 -> 28,010 으로 실제 입력량을 반영한다.

### D4 (Medium) 아카이빙이 이동이 아니라 복사이고, 매 실행 재보고된다 [수정됨]

- 현상: `timeline_limit` 초과분이 `archive/{slug}-{year}.md` 로 만들어지지만 주제 페이지 타임라인은 그대로 3건이고 아카이브 링크도 붙지 않는다. 변경이 없는데도 compose 를 돌릴 때마다 "아카이브 1건" 을 보고한다.
- 원인: 초과분 아카이브 기록과 카운트는 무조건 수행하지만 (`src/compose/index.ts:351-354`), 페이지 본문 쓰기는 `needsIncremental`(신규 항목이 있을 때)일 때만 일어난다 (`:348`, `:365`).
- 영향: PRD 5.5 "오래된 항목을 아카이브로 이동한다" 미충족. 실행 리포트의 `archived` 수치가 신뢰할 수 없다.
- 수정: 페이지를 항상 렌더해 디스크 내용과 비교하고 달라졌을 때만 쓴다(`writeIfChanged`). 아카이브 파일도 내용이 바뀐 경우에만 쓰고, 그때 옮겨진 항목 수만 `archived` 로 센다.
- 재검증: `timeline_limit: 2` 로 compose -> 본문 타임라인 2건으로 절삭 + `archive/security-2026.md` 링크 생성, 1회차 아카이브 1건 / 2회차 0건, 마크다운 해시 동일(멱등).

### D5 (Medium) 한국어 검색이 조사가 붙은 단어를 찾지 못한다 [수정됨]

- 현상: 요약 본문에 "마이그레이션을" 이 있는데 `search 마이그레이션` 은 0건이다. "마이그" 같은 부분 일치도 0건.
- 원인: FTS5 기본 토크나이저에 한국어 형태소 분석이 없어 "마이그레이션을" 이 통째로 한 토큰이 된다. 질의는 정확 일치 토큰으로만 매칭된다.
- 영향: 요약이 전부 한국어인 제품에서 검색 체감 품질이 크게 떨어진다. 영문 고유명사 검색은 정상이라 증상이 가려진다.
- 수정: 각 질의 토큰을 `"토큰"*` 접두 검색으로 만든다 (`src/search/fts.ts`).
- 재검증: `search 마이그레이션` 이 1건을 찾는다. 기존 영문/숫자/한국어 질의와 잘못된 FTS 구문 처리에는 회귀가 없다.

### D6 (Low) 검색 결과의 snippet 이 항상 null [수정됨]

- 현상: CLI/`search-index.json` 어느 경로든 `snippet` 필드가 null 이다. 매칭 문맥을 볼 수 없다.
- 원인: `snippet(articles_fts, 1, ...)` 를 호출하지만 (`src/search/fts.ts:94`) `articles_fts` 는 contentless(`content=''`) 테이블이라 원문을 복원할 수 없어 NULL 이 나온다 (`src/search/fts.ts:1`).
- 수정: `summaries.summary_ko` 를 조인해 질의어 주변 40자를 잘라 스니펫을 만든다. 매칭 위치가 없으면 앞부분을 자른다.
- 재검증: `...MariaDB에서 PostgreSQL로의 데이터베이스 마이그레이션을 돕는...` 형태로 문맥이 나온다.

### D7 (Medium) 취소가 단계 경계에서만 반영된다 [수정됨]

- 현상: extract 10/60 시점에 취소를 요청했는데 남은 50건을 모두 처리한 뒤 41초 후에야 `cancelled` 가 됐다.
- 원인: 각 스테이지 루프는 이미 `throwIfCancelled(ctx)` 로 `ctx.signal` 을 확인하고 있었다. 문제는 그 signal 이 켜지지 않는 것이었다. 취소 API 는 DB 의 `cancel_requested` 만 1 로 바꾸고, 파이프라인은 그 플래그를 **스테이지 경계에서만** 읽어 `controller.abort()` 를 불렀다 (`src/jobs/pipeline.ts`).
- 영향: PRD 5.8 "각 단계 경계와 워커 루프에서 취소 플래그를 확인한다" 미충족. 도메인 rate limit 1rps 때문에 대량 extract 에서는 수 분간 취소가 먹지 않는다.
- 수정: 파이프라인이 `cancel_requested` 를 1초 주기로 폴링해 즉시 `controller.abort()` 한다 (`cancelPollMs` 로 조정 가능). 기존 `throwIfCancelled` 들이 그대로 동작한다.
- 재검증: extract 10/60 시점에 취소 -> 2.1초 만에 `cancelled`, 12/60 에서 중단.

### D8 (Low) feeds 서브커맨드의 --config 의미가 다르다 [수정됨]

- 현상: `--config` 는 파이프라인 설정 경로로 문서화돼 있는데 (`README`, `HELP`), `feeds` 서브커맨드는 이를 feeds.yaml 경로로 쓴다 (`src/cli.ts:69`). `feeds list --config config/rss-wiki.yaml` 은 오류 없이 "등록된 피드: 0개" 를 출력한다.
- 수정: `--feeds <path>` 옵션을 추가하고 feeds 서브커맨드는 이것만 쓴다. `--config` 는 파이프라인 설정 전용으로 되돌렸다. collect/run/serve 에도 `--feeds` 가 전달되도록 `StageCtx.feedsPath` 를 연결했다 (이전에는 CLI 에서 주입되지 않아 항상 `config/feeds.yaml` 고정이었다).
- 재검증: `feeds list --feeds <path>` 정상, `--config` 를 줘도 피드 목록에 영향 없음. 회귀 테스트도 추가했다.

### D9 (Low) enrich 출력의 "부분성공 false개" [수정됨]

- 현상: `요약 완료: ... 부분성공 false개` 처럼 boolean 을 개수로 출력한다 (`src/cli.ts` enrich 분기, `EnrichResult.partial` 은 boolean).
- 수정: `요약 완료 (부분 완료): 성공 1개, 실패 0개, 예산/취소로 중단 11개, ...` 형태로 바꿨다.

### D10 (Low) collect 가 extract 용 타임아웃 설정을 재사용한다 [수정됨]

- 현상: `extract.fetch_timeout_ms` 를 1ms 로 낮추자 피드 수집까지 전부 타임아웃으로 실패했다.
- 원인: `src/collect/index.ts:134` 이 `cfg.extract.fetch_timeout_ms` 를 피드 fetch 타임아웃으로 넘긴다.
- 수정: `collect.fetch_timeout_ms` (기본 10초) 를 신설하고 collect 가 이것을 쓴다. README 에도 반영했다.
- 재검증: `extract.fetch_timeout_ms: 1` 상태에서 collect 가 피드 4개를 정상 수집한다.

### D11 (Medium) 진행 페이로드의 errors 가 실패를 드러내지 않는다 [수정됨]

- 현상: 404 피드가 있는 run 에서 DB 는 `feeds_failed=1` 인데 `GET /api/runs/:id` 의 `errors` 는 0 이고 collect 단계는 `done: 5, total: 5, error: null` 이다. 예산 중단 run 도 `articles_failed=3` 이지만 `errors` 는 0.
- 원인: `errors` 를 "에러가 기록된 단계 수" 로 계산한다 (`src/jobs/runs.ts:109`).
- 영향: 완료 토스트와 진행 UI 에서 사용자가 실패를 알 수 없다.
- 수정: `errors = 스테이지 오류 + feeds_failed + articles_failed` 로 바꾸고 `errorBreakdown: { stages, feeds, articles }` 를 함께 내보낸다.
- 재검증: 404 피드가 있는 run 에서 `errors: 1`, `errorBreakdown: { stages: 0, feeds: 1, articles: 0 }`.

### D12 (High) 실측 비용이 일일 예산 기준을 초과한다 [부분 수정 / 결정 필요]

- 현상: 글 8건 요약에 $0.3109 (건당 $0.0389). PRD 기준인 하루 30글이면 약 $1.17 로 `daily_budget_usd: 0.5` 를 2.3배 초과한다. 현재 설정으로는 하루 12~13글 시점에 예산 가드가 걸려 잡이 `partial` 로 끝난다.
- 원인: `claude -p` 는 호출마다 Claude Code 시스템 프롬프트(실측 약 27K 토큰 캐시)를 함께 태운다. "OK 만 답하라" 는 최소 프롬프트도 $0.0293 이 나온다. 즉 비용이 글 길이가 아니라 호출 횟수에 지배된다.
- 영향: PRD 3절 성공 기준("하루 LLM 비용 $0.5 이하") 미달. D2 와 겹치면 예산 초과 시점의 진행 중 글이 실패로 기록된다.
- 참고: 예산 가드는 호출이 끝난 뒤 판정하므로 동시 실행 수(기본 4)만큼 초과분이 발생할 수 있다.
- 수정(부분): (1) 예산 검사를 선반영으로 바꿔 동시 실행 수만큼 예산을 넘기던 문제를 막았다. (2) `doctor` 가 `summaries` 실측 평균으로 하루 30글 비용을 예측해 한도 초과가 예상되면 문제로 보고한다.
- 남은 것: 호출당 고정 오버헤드 자체는 `claude -p` 구조에서 코드로 줄일 수 없다. 위 "남은 결정 사항 (D12)" 의 세 가지 중 하나를 골라야 한다.

### D13 (Medium) FTS 인덱스가 build 단계에서만 재구축된다 [수정됨]

- 현상: `enrich` -> `compose` 까지 끝낸 직후 `rss-wiki search PostgreSQL` 이 0건을 반환한다. `build` 를 한 번 돌리면 같은 질의가 정상 매칭된다.
- 원인: `reindexFts(db)` 호출부가 `src/build/index.ts:216` 한 곳뿐이다.
- 영향: PRD 8절은 각 단계를 독립 실행 가능한 서브커맨드로 규정하는데, CLI 검색이 정적 사이트 빌드에 암묵적으로 의존한다. `run` 전체 파이프라인을 쓰면 가려지는 문제다.
- 수정: `enrich` 가 새 요약을 하나라도 만들면 종료 시 FTS 를 재인덱싱한다. 인덱싱 실패는 경고만 남기고 스테이지를 실패시키지 않는다.
- 재검증: `build` 없이 `enrich` 직후 `search` 가 매칭된다.

---

## 5. 재현 방법

결함 13건은 `test/qa-regression.test.ts` 에 회귀 테스트로 고정돼 있다. 아래 두 가지를 돌리면 된다.

```bash
# 단위 회귀 (qa-regression.test.ts 포함)
pnpm test && pnpm typecheck

# E2E (샌드박스 생성 -> 전 구간 실행 -> 검증)
bash test/e2e/qa-e2e.sh                                  # LLM 호출 없는 구간만 (기본, 비용 0)
RSS_WIKI_QA_LLM=1 RSS_WIKI_QA_BACKFILL=1 \
  bash test/e2e/qa-e2e.sh                                # enrich/compose/search 포함 (실제 비용 발생)
```

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `RSS_WIKI_QA_LLM` | `0` | `1` 이면 enrich/compose/search 까지 검증한다. 0 이면 예산을 0 으로 두어 LLM 호출이 일어나지 않는다 |
| `RSS_WIKI_QA_BACKFILL` | `2` | 피드당 수집 글 수. LLM 검증 비용을 줄이려면 `1` |
| `RSS_WIKI_QA_PORT` | `4399` | serve 검증에 쓸 포트 |

스크립트는 `${TMPDIR}/rss-wiki-qa` 아래에 샌드박스를 만들고 저장소 작업 트리는 수정하지 않는다.
검증 후에도 샌드박스를 남기므로 실패 시 `collect1.log` / `enrich.log` / `serve.log` 등을 직접 볼 수 있다.
