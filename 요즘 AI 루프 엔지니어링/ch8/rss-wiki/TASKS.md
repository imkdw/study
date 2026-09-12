# RSS Wiki - TASKS

> docs/PRD.md 기반 구현 작업 목록
> 규칙: 한 번에 한 항목. 막히면 해당 항목에 `BLOCKED: 사유` 를 적고 다음으로 넘어간다.

## M0. 기반

- [x] T0.1 프로젝트 스캐폴드 (package.json / tsconfig / 디렉터리 / 의존성)
- [x] T0.2 공용 타입 정의 `src/types.ts`
- [x] T0.3 SQLite 스키마 + 마이그레이션 `src/db/schema.sql`, `src/db/index.ts` (PRD 7절 전체 테이블 + one_active_run 부분 유니크 인덱스 + FTS5)
- [x] T0.4 설정 로더 `src/config.ts` (config/rss-wiki.yaml, config/feeds.yaml, 기본값 병합, concurrency 상한 8 클램프)
- [x] T0.5 로거 `src/util/log.ts` + 잡 로그 파일 `.rss-wiki/logs/{runId}.log`

## M1. collect

- [x] T1.1 피드 파서 `src/collect/feedParser.ts` (RSS 2.0 / Atom / JSON Feed)
- [x] T1.2 조건부 요청 `src/collect/fetchFeed.ts` (etag / last-modified, 304 처리)
- [x] T1.3 collect 스테이지 `src/collect/index.ts` (신규 글 판별, 백필 한도 20, 사이클 상한 200)
- [x] T1.4 피드 헬스 정책 (연속 5회 실패 -> unhealthy/7일 주기, 20회 -> disabled)
- [x] T1.5 테스트: 세 포맷 파싱 / 304 / 백필 한도 / 헬스 전이

## M2. extract + dedupe

- [x] T2.1 본문 추출기 `src/extract/readable.ts` (Readability 계열 스코어링, 상한 50,000자 절삭)
- [x] T2.2 extract 스테이지 `src/extract/index.ts` (RSS content >= 1000자면 그대로, 아니면 fetch, 실패 시 rss_fallback)
- [x] T2.3 안전장치 `src/extract/guard.ts` (도메인별 rate limit 1rps, robots.txt 존중, UA 식별자, 타임아웃 10초)
- [x] T2.4 URL 정규화 `src/util/url.ts` (소문자화, 트레일링 슬래시, 추적 쿼리 제거, 프래그먼트 제거, 해시)
- [x] T2.5 제목 유사도 `src/util/similarity.ts` (정규화 제목 + 유사도 0.85 임계치)
- [x] T2.6 dedupe 스테이지 `src/dedupe/index.ts` (url_hash 동일 판정 + 사이클 내 클러스터링)
- [x] T2.7 테스트: 정규화 / 유사도 / 클러스터 / rss_fallback / 절삭

## M3. enrich (claude -p 워커 풀)

- [x] T3.1 claude 러너 `src/llm/claudeRunner.ts` (stdin 프롬프트, --output-format json, --allowed-tools "", --max-turns 1, 120초 타임아웃, SIGTERM->5초->SIGKILL)
- [x] T3.2 JSON 블록 추출 + 스키마 검증 `src/llm/jsonSchema.ts` (파싱 실패 1회 재시도 후 dead_letter)
- [x] T3.3 워커 풀 `src/llm/pool.ts` (고정 크기 큐 소비자, 글 단위 격리, 배치 대기 금지)
- [x] T3.4 레이트 리밋 대응 (지수 백오프, 연속 3회 시 동시 실행 수 반감 4->2->1, 5분 성공 시 원복)
- [x] T3.5 프롬프트 `src/llm/prompts.ts` (시드 카테고리 고정 프리픽스, JSON 스키마 명시, 한국어 강제)
- [x] T3.6 enrich 스테이지 `src/enrich/index.ts` (호출당 개별 트랜잭션 커밋, 진행률 증가, 예산 초과 시 중단 -> partial)
- [x] T3.7 카테고리 정책 `src/enrich/categories.ts` (신규 제안 pending 누적, 3건 승격, confidence<0.5 -> misc + 리뷰 큐)
- [x] T3.8 테스트: 풀 병렬성 / 개별 실패 격리 / 타임아웃 / 백오프 감속 / 카테고리 승격 / 예산 가드

## M4. compose

- [x] T4.1 페이지 렌더러 `src/compose/render.ts` (이번 주 / 지금까지의 흐름 / 타임라인 / 관련 주제 / 출처)
- [x] T4.2 증분 갱신 (타임라인 append, 이번 주 재생성, 흐름 보존)
- [x] T4.3 전체 재작성 (주 1회 또는 신규 10개 누적, 동시 2, 실패 시 직전 파일 유지)
- [x] T4.4 아카이빙 (타임라인 30개 컷 -> `archive/{slug}-{year}.md`)
- [x] T4.5 index.md 생성 (주제 목록 + 이번 주 하이라이트)
- [x] T4.6 멱등성 (같은 사이클 두 번 돌려도 동일 산출물)
- [x] T4.7 테스트: 렌더 스냅샷 / 증분 / 아카이브 컷 / 멱등성 / 재작성 실패 시 원본 유지

## M5. build + search

- [x] T5.1 FTS5 인덱싱 `src/search/fts.ts` (title / summary_ko / key_points / entities)
- [x] T5.2 검색 API `src/search/index.ts` + `search-index.json` 생성 (1MB 초과 시 축소)
- [x] T5.3 마크다운 렌더 `src/build/markdown.ts` (위키링크 `[[slug]]` 지원)
- [x] T5.4 정적 사이트 빌드 `src/build/index.ts` -> `dist/` (사이드바 / 본문 / 검색 박스 / 갱신 시각)
- [x] T5.5 테마 + 반응형 (다크 모드, 400px 폭)
- [x] T5.6 모드 주입 `window.__RSS_WIKI_MODE__` (정적 배포 시 수집 버튼 DOM 제외)
- [x] T5.7 테스트: FTS 검색 / 인덱스 축소 / 위키링크 / 모드별 버튼 유무

## M6. serve + 수집 트리거

- [x] T6.1 잡 큐 `src/jobs/runs.ts` (queued/running 동시 1개, 부분 유니크 인덱스 잠금)
- [x] T6.2 heartbeat + stale 회수 (60초 미갱신 시 stale 판정 후 회수)
- [x] T6.3 협조적 취소 (단계 경계 + 워커 루프 플래그 확인, 자식 프로세스 SIGTERM)
- [x] T6.4 파이프라인 러너 `src/jobs/pipeline.ts` (collect->extract->dedupe->enrich->compose->build, 단계별 run_stages 기록)
- [x] T6.5 HTTP 서버 `src/server/index.ts` (POST /api/runs 즉시 반환, GET /api/runs/:id, /stream SSE, /cancel, /api/runs?limit)
- [x] T6.6 정적 파일 서빙 + 완료 시 새로고침/토스트용 페이로드
- [x] T6.7 테스트: 409 중복 방지 / 즉시 반환 / 진행 페이로드 스키마 / SSE / stale 회수 / 취소

## M7. 운영

- [x] T7.1 CLI `src/cli.ts` (collect / enrich / compose / build / run / serve / search / feeds / doctor)
- [x] T7.2 재시도 정책 `src/util/retry.ts` (지수 백오프 3회 1m/5m/25m, dead_letter 격리, failed_reason 분류)
- [x] T7.3 전역 가드 (사이클 200개 상한, 일일 예산 $0.5, runs 리포트 콘솔 출력)
- [x] T7.4 doctor (claude CLI 확인 / dead_letter / unhealthy feed / pending category / stale job)
- [x] T7.5 cron 스케줄 문서화 + 샘플 설정
- [x] T7.6 테스트: 재시도 전이 / dead_letter / 예산 가드 / doctor 리포트

## 최종

- [x] T8.1 전체 테스트 통과 (`pnpm test`)
- [x] T8.2 타입 체크 통과 (`pnpm typecheck`)
- [x] T8.3 README 작성
