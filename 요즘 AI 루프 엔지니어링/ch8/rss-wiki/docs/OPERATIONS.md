# 운영 가이드

## 1. cron 으로 매일 실행하기

`rss-wiki run` 하나로 `collect -> extract -> dedupe -> enrich -> compose -> build`
전체 파이프라인이 순서대로 돈다. 매일 아침 한 번 돌리는 예시:

```cron
0 7 * * * cd /path/to/rss-wiki && ./src/cli.ts run >> .rss-wiki/logs/cron.log 2>&1
```

- 실행 전 `chmod +x src/cli.ts` 로 실행 권한을 준다 (셔뱅이
  `#!/usr/bin/env -S node --experimental-strip-types` 로 되어 있다).
- 로그 디렉터리(`.rss-wiki/logs`)는 자동으로 만들어진다.
- 동시에 두 개의 run 이 돌지 않도록 `runs` 테이블에 부분 유니크 인덱스가 걸려
  있다. cron 주기가 겹쳐도 안전하다 (`ActiveRunError`).
- 실패한 사이클이 있어도 다음 cron 실행에서 `discovered`/`failed` 상태의 글을
  이어서 처리한다.

절대경로가 필요하면 `node --experimental-strip-types /path/to/rss-wiki/src/cli.ts run`
형태로 직접 node 를 호출해도 된다.

## 2. GitHub Actions 스케줄 워크플로 예시

정적 배포(GitHub Pages 등)와 함께 쓰는 경우, DB 와 `docs/wiki/`를 저장소에
커밋해 상태를 유지하는 방식을 권장한다.

```yaml
# .github/workflows/rss-wiki.yml
name: rss-wiki daily run

on:
  schedule:
    - cron: "0 22 * * *" # UTC 22:00 = KST 07:00
  workflow_dispatch: {}

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"

      - run: npm ci

      - name: Run pipeline
        env:
          RSS_WIKI_SKIP_CLAUDE_CHECK: "0"
        run: node --experimental-strip-types src/cli.ts run --trigger cron

      - name: Build static site
        run: node --experimental-strip-types src/cli.ts build --mode static

      - name: Commit updated wiki/db/dist
        run: |
          git config user.name "rss-wiki-bot"
          git config user.email "rss-wiki-bot@users.noreply.github.com"
          git add docs/wiki .rss-wiki dist
          git diff --cached --quiet || git commit -m "chore: rss-wiki daily run"
          git push
```

`claude` CLI 인증(예: `CLAUDE_CODE_OAUTH_TOKEN` 등 사용 중인 인증 방식에 맞는
시크릿)을 워크플로 환경변수로 주입해야 `enrich` 단계가 동작한다.

## 3. doctor 사용법

```bash
rss-wiki doctor
```

다음을 한 번에 점검하고 한국어 리포트를 출력한다.

- `claude` CLI 가 실행 가능한지 (`claude --version`)
- `dead_letter` 로 격리된 글 목록
- `unhealthy`/`disabled` 피드 목록
- 승격 대기 중인(pending) 신규 카테고리
- heartbeat 이 끊긴 stale 잡
- 오늘자 LLM 예산 사용량과 초과 여부

문제가 하나라도 있으면 종료 코드 1을 돌려주므로, cron/CI 에 상태 점검용으로
엮어도 된다:

```bash
rss-wiki doctor || echo "점검 실패, 알림 필요"
```

테스트나 claude CLI 가 없는 환경에서 claude 확인만 건너뛰려면:

```bash
RSS_WIKI_SKIP_CLAUDE_CHECK=1 rss-wiki doctor
```

## 4. dead_letter 처리

글은 실패할 때마다 `retry_count` 가 올라가고, 지수 백오프(1분/5분/25분)
후에 다음 사이클에서 자동으로 재시도된다. `retry.max_attempts`(기본 3회)를
넘기면 `status = 'dead_letter'` 로 격리되고, 이후 사이클에서는 건드리지
않는다.

`doctor` 리포트의 `dead_letter 글` 목록에서 글 id 와 `failed_reason`
(`network`/`parse`/`llm_error`/`llm_refusal`/`timeout`)을 확인한다.
원인을 해결한 뒤 수동으로 재시도하려면 DB 에서 직접 상태를 되돌린다:

```bash
sqlite3 .rss-wiki/rss-wiki.db \
  "UPDATE articles SET status='discovered', retry_count=0, next_retry_at=NULL, failed_reason=NULL WHERE id=<id>;"
```

`retry_count` 를 0으로 되돌리면 다시 최대 3회까지 재시도 기회를 준다.

## 5. 예산 가드 동작

- `llm.daily_budget_usd`(기본 $0.5)를 기준으로, `enrich` 단계는 매 호출마다
  `budget_usage` 테이블에 비용을 누적한다.
- 오늘 누적 비용이 한도 이상이면 그 시점에서 요약을 중단한다. 아직 처리하지
  못한 글은 `discovered` 상태로 남아 다음 사이클(다음 날)에 이어서 처리된다.
- 날짜는 `timezone`(기본 `Asia/Seoul`) 기준 자정에 새로 초기화된다.
- `doctor` 의 `예산` 항목에서 오늘 사용량/한도/초과 여부를 확인할 수 있다.
