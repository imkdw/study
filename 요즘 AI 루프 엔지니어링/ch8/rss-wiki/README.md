# rss-wiki

RSS 리더에 LLM(`claude -p`)을 붙여서, 구독한 피드의 글을 주제별로 누적 요약하는
위키를 자동으로 만들어주는 도구다. 매일 새 글을 수집/요약해서 주제 페이지에
증분으로 쌓고, 정적 HTML 사이트로 빌드한다.

## 무엇을 하는가

1. `collect` - RSS/Atom/JSON Feed 를 조건부 요청(etag/last-modified)으로 수집한다.
2. `extract` - RSS 본문이 짧으면 원문을 fetch 해서 본문을 확보한다.
3. `dedupe` - URL 정규화 + 제목 유사도로 중복 글을 하나의 클러스터로 묶는다.
4. `enrich` - `claude -p` 워커 풀로 글마다 한국어 요약/분류를 만든다.
5. `compose` - 주제별 위키 마크다운(`docs/wiki/*.md`)을 증분 갱신하고, 주기적으로
   전체를 재작성하며, 오래된 항목을 아카이브한다.
6. `build` - 정적 HTML(`dist/`)과 검색 인덱스(`search-index.json`)를 만든다.

전체 과정은 `rss-wiki run` 하나로 순서대로 실행되며, cron 이나
`rss-wiki serve` 의 "수집하기" 버튼으로 트리거할 수 있다.

## 설치

```bash
pnpm install
```

Node 24 이상이 필요하다 (네이티브 TypeScript 타입 스트리핑, `node:sqlite` 사용).
빌드 단계는 없다. `claude` CLI 가 PATH 에 있어야 `enrich` 단계가 동작한다.

```bash
node --version   # v24 이상
which claude      # claude CLI 설치 확인
```

## 설정 파일

### `config/rss-wiki.yaml`

파이프라인 전반의 동작을 정의한다. 값을 지정하지 않으면 `src/config.ts` 의
기본값이 쓰인다. 주요 항목:

- `collect.fetch_timeout_ms` - 피드 fetch 타임아웃(기본 10초). 원문 fetch 타임아웃
  (`extract.fetch_timeout_ms`) 과 별개로 조정한다.
- `llm.daily_budget_usd` - 하루 LLM 지출 상한(USD). 초과하면 그날 요약을 중단한다.
  중단된 글은 실패로 기록하지 않고 다음 사이클에서 다시 처리한다.
- `llm.rewrite_model` - 위키 페이지 전체 재작성에 쓰는 모델. `compose` 가 이 모델로
  "지금까지의 흐름" 을 다시 쓴다.
- `llm.concurrency` - `enrich` 동시 실행 수 (최대 8로 클램프).
- `retry.max_attempts` / `retry.backoff_ms` - 글 단위 재시도 정책 (기본 3회,
  1분/5분/25분).
- `server.stale_job_timeout_ms` - heartbeat 이 끊긴 잡을 회수하는 기준.

전체 예시는 `docs/PRD.md` 11절과 저장소의 `config/rss-wiki.yaml` 을 참고한다.

### `config/feeds.yaml`

구독 피드 목록. `rss-wiki feeds` 서브커맨드로 관리한다.

```yaml
feeds:
  - url: https://example.com/rss
    name: Example Blog
    seed_categories: [llm]
    enabled: true
```

## 주요 명령

```bash
rss-wiki collect                      # 피드 수집
rss-wiki extract                      # 본문 확보
rss-wiki dedupe                       # 중복 제거
rss-wiki enrich [--concurrency 4]     # LLM 요약/분류
rss-wiki compose [--rewrite-all]      # 위키 페이지 갱신
rss-wiki build [--mode static|local]  # 정적 사이트 빌드
rss-wiki run [--trigger cron|manual]  # 전체 파이프라인
rss-wiki serve [--port 4321]          # 로컬 웹 UI + 수집 트리거 API
rss-wiki search <질의어>               # 검색
rss-wiki feeds add <url> [--name X]   # 피드 추가
rss-wiki feeds list                   # 피드 목록
rss-wiki feeds disable <url>          # 피드 비활성화
rss-wiki doctor                       # 운영 상태 점검
```

공통 옵션: `--config <path>` (파이프라인 설정, 기본 `config/rss-wiki.yaml`),
`--feeds <path>` (피드 목록, 기본 `config/feeds.yaml`), `--db <path>`
(기본 설정 파일의 `dbPath`).

각 단계는 독립적으로 재실행할 수 있는 CLI 서브커맨드다. 파이프라인이 중간에
죽어도 실패한 단계부터 다시 실행하면 된다.

## 로컬 모드 vs 정적 배포

`build --mode local` 은 "수집하기" 버튼과 실시간 진행률 UI를 포함한 페이지를
만든다 (`rss-wiki serve` 와 함께 쓰는 것을 전제로 한다). `build --mode static`
은 수집 트리거 관련 DOM을 제외한, 순수 정적 배포용 산출물을 만든다 (예: GitHub
Pages). 두 모드 모두 같은 마크다운 원본(`docs/wiki/`)에서 만들어지므로 내용은
동일하다.

## 비용에 관한 주의

`claude -p` 는 호출마다 Claude Code 시스템 프롬프트를 함께 태우기 때문에, 비용이 글
길이가 아니라 **호출 횟수**에 지배된다. 실측으로 글 하나당 약 $0.039 이고, 하루 30글
기준이면 약 $1.17 로 기본 예산($0.5)을 넘는다. `rss-wiki doctor` 가 실측 평균으로
하루 비용을 예측해 한도 초과가 예상되면 알려준다. 예산에 맞추려면 처리량을 줄이거나
`llm.daily_budget_usd` 를 실측에 맞게 올린다.

운영(cron 등록, doctor 사용법, 예산/재시도 정책)은 `docs/OPERATIONS.md` 를 본다.
QA 테스트 케이스와 E2E 실행 방법은 `docs/QA-TESTCASES.md` 를 본다.
