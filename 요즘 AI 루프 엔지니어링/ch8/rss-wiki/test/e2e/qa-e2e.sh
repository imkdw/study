#!/usr/bin/env bash
# rss-wiki E2E QA 스크립트.
# 실제 개발 RSS 피드로 파이프라인 전 구간을 돌리고 docs/QA-TESTCASES.md 의 핵심 TC 를 검증한다.
#
#   bash test/e2e/qa-e2e.sh                    # LLM 호출 없는 구간만
#   RSS_WIKI_QA_LLM=1 bash test/e2e/qa-e2e.sh  # enrich/compose/search 포함 (실제 비용 발생)
#
# 샌드박스는 ${TMPDIR}/rss-wiki-qa 에 만들고 저장소 작업 트리는 건드리지 않는다.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="$REPO/src/cli.ts"
NODE_RUN=(node --experimental-strip-types "$CLI")
SANDBOX="${TMPDIR:-/tmp}/rss-wiki-qa"
PORT="${RSS_WIKI_QA_PORT:-4399}"
# LLM 단계를 끄면 예산을 0 으로 둬서 서버 트리거 run 이 enrich 에 진입하지 않게 한다 (비용 0).
if [ "${RSS_WIKI_QA_LLM:-0}" = "1" ]; then BUDGET="0.5"; else BUDGET="0"; fi
BACKFILL="${RSS_WIKI_QA_BACKFILL:-2}"   # 피드당 수집 글 수. LLM 단계를 켤 때 비용을 줄이려면 1 로.
PASS=0
FAIL=0
SERVE_PID=""

ok()   { PASS=$((PASS+1)); printf '  PASS  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL  %s\n    기대: %s\n    실제: %s\n' "$1" "$2" "$3"; }
check(){ # check <설명> <기대> <실제>
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "$2" "$3"; fi
}
check_gt(){ # check_gt <설명> <최소값(초과)> <실제>
  if [ "$3" -gt "$2" ] 2>/dev/null; then ok "$1 ($3)"; else bad "$1" "> $2" "$3"; fi
}
section(){ printf '\n== %s\n' "$1"; }

cleanup(){ [ -n "$SERVE_PID" ] && kill "$SERVE_PID" 2>/dev/null; }
trap cleanup EXIT

sql(){ # sql <질의> -> 첫 컬럼 값
  node -e '
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(".rss-wiki/rss-wiki.db");
    const row = db.prepare(process.argv[1]).get();
    process.stdout.write(String(row ? Object.values(row)[0] : ""));
  ' "$1"
}

# ---------- 샌드박스 준비 ----------
rm -rf "$SANDBOX"
mkdir -p "$SANDBOX/config"
cd "$SANDBOX" || exit 1

cat > config/feeds.yaml <<'YAML'
feeds:
  - url: https://simonwillison.net/atom/everything/
    name: Simon Willison's Weblog
    seed_categories: [llm]
    enabled: true
  - url: https://blog.cloudflare.com/rss/
    name: Cloudflare Blog
    seed_categories: [infra, security]
    enabled: true
  - url: https://www.postgresql.org/news.rss
    name: PostgreSQL News
    seed_categories: [database]
    enabled: true
  - url: https://blog.jim-nielsen.com/feed.json
    name: Jim Nielsen's Blog
    seed_categories: [frontend]
    enabled: true
  - url: https://jsonfeed.org/feed.json
    name: BROKEN Feed (404)
    seed_categories: []
    enabled: true
YAML

cat > config/rss-wiki.yaml <<YAML
dbPath: .rss-wiki/rss-wiki.db
collect:
  backfill_limit: $BACKFILL
extract:
  rss_content_min_length: 1000
  fetch_timeout_ms: 10000
llm:
  concurrency: 4
  daily_budget_usd: $BUDGET
  # QA 는 배선 검증이 목적이라 재작성도 저렴한 모델로 돌린다 (운영 기본값은 sonnet)
  rewrite_model: claude-haiku-4-5
server:
  port: $PORT
  host: 127.0.0.1
  enable_manual_run: true
YAML

printf 'rss-wiki E2E QA\n샌드박스: %s\nLLM 단계: %s\n' "$SANDBOX" "${RSS_WIKI_QA_LLM:-0}"

# ---------- collect ----------
section "collect (TC-CO-01~09)"
"${NODE_RUN[@]}" collect > collect1.log 2>&1
check_gt "TC-CO-01~04 세 포맷 수집 + 백필 한도" 0 "$(sql 'select count(*) c from articles')"
check "TC-CO-04 백필 한도 준수" "0" "$(sql "select count(*) c from (select feed_id from articles group by feed_id having count(*) > $BACKFILL)")"
check "TC-CO-05 조건부 요청 헤더 저장" "0" "$(sql "select count(*) c from feeds where health = 'healthy' and etag is null and last_modified is null and last_fetched_at is not null")"
BEFORE=$(sql 'select count(*) c from articles')
"${NODE_RUN[@]}" collect > collect2.log 2>&1
check "TC-CO-06 재수집 멱등 (신규 0건)" "$BEFORE" "$(sql 'select count(*) c from articles')"
check_gt "TC-CO-07 실패 피드 격리 (연속 실패 기록)" 0 "$(sql 'select coalesce(max(consecutive_failures),0) c from feeds')"

# ---------- extract ----------
section "extract (TC-EX-01~04)"
"${NODE_RUN[@]}" extract > extract.log 2>&1
check "TC-EX-01~03 모든 글에 본문 출처 부여" "0" "$(sql 'select count(*) c from articles where content_source is null')"
check "TC-EX-04 본문 상한 준수" "0" "$(sql 'select count(*) c from articles where length(raw_content) > 50000')"

# ---------- dedupe ----------
section "dedupe (TC-DE-01~03)"
"${NODE_RUN[@]}" dedupe > dedupe.log 2>&1
check "TC-DE-01 URL 정규화 (트레일링 슬래시 제거)" "0" "$(sql "select count(*) c from articles where normalized_url like '%/'")"
check "TC-DE-02 정규화 URL 중복 없음" "0" "$(sql 'select count(*) c from (select url_hash from articles group by url_hash having count(*) > 1)')"
check "TC-DE-03 모든 글에 클러스터 부여" "0" "$(sql 'select count(*) c from articles where cluster_id is null')"

# ---------- enrich / compose / search (선택) ----------
if [ "${RSS_WIKI_QA_LLM:-0}" = "1" ]; then
  section "enrich (TC-EN-01~03)"
  "${NODE_RUN[@]}" enrich --concurrency 4 > enrich.log 2>&1
  tail -1 enrich.log
  check_gt "TC-EN-01 요약 생성" 0 "$(sql 'select count(*) c from summaries')"
  check "TC-EN-02 한국어 요약 비어있지 않음" "0" "$(sql "select count(*) c from summaries where trim(coalesce(summary_ko,'')) = ''")"
  check "TC-EN-03 모든 글에 카테고리 부여" "0" "$(sql 'select count(*) c from summaries where article_id not in (select article_id from article_categories)')"

  section "compose (TC-CM-01~04)"
  "${NODE_RUN[@]}" compose > compose1.log 2>&1
  tail -1 compose1.log
  check_gt "TC-CM-02 index.md 생성" 0 "$(grep -c '## 주제 목록' docs/wiki/index.md 2>/dev/null || echo 0)"
  TOPIC=$(ls docs/wiki/*.md | grep -v index.md | head -1)
  for s in "## 이번 주" "## 지금까지의 흐름" "## 타임라인" "## 관련 주제" "## 출처"; do
    check "TC-CM-01 섹션 존재: $s" "1" "$(grep -c "^$s" "$TOPIC" | head -1)"
  done
  find docs/wiki -name '*.md' -exec shasum {} \; | sort > wiki_before.txt
  "${NODE_RUN[@]}" compose > compose2.log 2>&1
  find docs/wiki -name '*.md' -exec shasum {} \; | sort > wiki_after.txt
  if diff -q wiki_before.txt wiki_after.txt > /dev/null; then ok "TC-CM-04 compose 멱등 (마크다운 동일)"; else bad "TC-CM-04 compose 멱등" "동일" "차이 발생"; fi

  section "search (TC-BS-06~07, TC-BS-10)"
  # D13 회귀: enrich 가 인덱스를 갱신하므로 build 를 돌리기 전에도 검색돼야 한다.
  check_gt "TC-BS-10 build 전에도 검색됨" 0 "$("${NODE_RUN[@]}" search PostgreSQL 2>/dev/null | head -1 | tr -dc '0-9')"
  "${NODE_RUN[@]}" build --mode local > build_pre.log 2>&1
  check_gt "TC-BS-06 검색 매칭" 0 "$("${NODE_RUN[@]}" search PostgreSQL 2>/dev/null | head -1 | tr -dc '0-9')"
  "${NODE_RUN[@]}" search '"unclosed' > /dev/null 2>&1
  check "TC-BS-07 잘못된 FTS 질의에도 크래시 없음" "0" "$?"
  # D6 회귀: 스니펫이 null 이 아니어야 한다
  check "TC-BS-09 검색 스니펫 채워짐" "0" "$("${NODE_RUN[@]}" search PostgreSQL 2>/dev/null | tail -1 | grep -c '"snippet":null')"

  section "아카이빙 (TC-CM-05)"
  # D4 회귀: timeline_limit 을 줄이면 본문이 잘리고, 두 번째 실행은 아카이브 0건이어야 한다
  printf '\ncompose:\n  timeline_limit: 1\n' >> config/rss-wiki.yaml
  ARCHIVE1=$("${NODE_RUN[@]}" compose 2>/dev/null | tail -1 | sed -E 's/.*아카이브 ([0-9]+)건.*/\1/')
  ARCHIVE2=$("${NODE_RUN[@]}" compose 2>/dev/null | tail -1 | sed -E 's/.*아카이브 ([0-9]+)건.*/\1/')
  TOPIC_MDS=$(ls docs/wiki/*.md | grep -v index.md)
  MAX_TIMELINE=0
  for f in $TOPIC_MDS; do
    n=$(grep -c '^- 20' "$f")
    [ "$n" -gt "$MAX_TIMELINE" ] && MAX_TIMELINE=$n
  done
  ARCHIVE_LINKS=$(grep -l 'archive/' $TOPIC_MDS 2>/dev/null | wc -l | tr -d ' ')
  check_gt "TC-CM-05 초과분 아카이브" 0 "$ARCHIVE1"
  check "TC-CM-05 변경 없으면 아카이브 재보고 안 함" "0" "$ARCHIVE2"
  check "TC-CM-05 본문 타임라인이 한도(1) 이하로 절삭" "1" "$MAX_TIMELINE"
  check_gt "TC-CM-05 아카이브 링크 표기" 0 "$ARCHIVE_LINKS"
else
  printf '\n(LLM 단계 건너뜀: RSS_WIKI_QA_LLM=1 로 켠다)\n'
fi

# ---------- build ----------
section "build (TC-BS-01~05)"
"${NODE_RUN[@]}" build --mode local > build_local.log 2>&1
check "TC-BS-01 dist 산출물 생성" "1" "$([ -f dist/index.html ] && [ -f dist/app.js ] && [ -f dist/styles.css ] && [ -f dist/search-index.json ] && echo 1 || echo 0)"
check "TC-BS-02 로컬 모드 주입" "1" "$(grep -c '__RSS_WIKI_MODE__ = "local"' dist/index.html)"
check_gt "TC-BS-02 수집 버튼 노출" 0 "$(grep -c '수집하기' dist/index.html)"
"${NODE_RUN[@]}" build --mode static > build_static.log 2>&1
check "TC-BS-03 정적 모드에서 수집 버튼 제외" "0" "$(grep -c '수집하기' dist/index.html)"
check "TC-BS-05 다크 모드 지원" "1" "$(grep -c 'prefers-color-scheme: dark' dist/styles.css | head -1)"
check "TC-BS-05 400px 대응" "1" "$(grep -c 'max-width: 400px' dist/styles.css | head -1)"
"${NODE_RUN[@]}" build --mode local > /dev/null 2>&1

# ---------- serve ----------
section "serve (TC-SV-01~08)"
"${NODE_RUN[@]}" serve --port "$PORT" > serve.log 2>&1 &
SERVE_PID=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 1
done

RESP=$(curl -s -X POST -w '\n%{http_code} %{time_total}' "http://127.0.0.1:$PORT/api/runs")
CODE=$(echo "$RESP" | tail -1 | cut -d' ' -f1)
TIME_MS=$(echo "$RESP" | tail -1 | cut -d' ' -f2 | awk '{printf "%d", $1 * 1000}')
RID=$(echo "$RESP" | head -1 | sed -E 's/.*"runId":"([^"]+)".*/\1/')
check "TC-SV-01 POST /api/runs 202" "202" "$CODE"
if [ "$TIME_MS" -lt 200 ]; then ok "TC-SV-01 응답 200ms 이내 (${TIME_MS}ms)"; else bad "TC-SV-01 응답 200ms 이내" "< 200ms" "${TIME_MS}ms"; fi

DUP=$(curl -s -X POST -w '\n%{http_code}' "http://127.0.0.1:$PORT/api/runs")
check "TC-SV-02 중복 트리거 409" "409" "$(echo "$DUP" | tail -1)"
check "TC-SV-02 진행 중 runId 반환" "$RID" "$(echo "$DUP" | head -1 | sed -E 's/.*"runId":"([^"]+)".*/\1/')"

STATUS=$(curl -s "http://127.0.0.1:$PORT/api/runs/$RID")
for f in '"stages"' '"collect"' '"enrich"' '"startedAt"' '"elapsedMs"'; do
  check "TC-SV-03 진행 페이로드 필드 $f" "1" "$(echo "$STATUS" | grep -c -- "$f")"
done

curl -sN --no-buffer --max-time 180 -H 'Accept: text/event-stream' "http://127.0.0.1:$PORT/api/runs/$RID/stream" > sse.txt 2>/dev/null
check_gt "TC-SV-04 SSE data 이벤트 수신" 0 "$(grep -c '^data:' sse.txt)"
check_gt "TC-SV-04 SSE 종료 이벤트" 0 "$(grep -c '^event:' sse.txt)"

check_gt "TC-SV-07 실행 이력 조회" 0 "$(curl -s "http://127.0.0.1:$PORT/api/runs?limit=5" | grep -c 'runId')"
# D11 회귀: 404 피드가 섞여 있으므로 errors 가 0 이면 안 된다
FINAL=$(curl -s "http://127.0.0.1:$PORT/api/runs/$RID")
check_gt "TC-SV-10 실패가 errors 로 드러남" 0 "$(echo "$FINAL" | sed -E 's/.*"errors":([0-9]+).*/\1/')"
check_gt "TC-SV-10 errorBreakdown 제공" 0 "$(echo "$FINAL" | grep -c 'errorBreakdown')"
check "TC-SV-08 경로 탈출 차단(상대경로)" "404" "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/../../../../etc/passwd")"
check "TC-SV-08 경로 탈출 차단(인코딩)" "403" "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/%2e%2e%2f%2e%2e%2fetc%2fpasswd")"

# ---------- doctor ----------
section "doctor (TC-OP-01~02)"
"${NODE_RUN[@]}" doctor > doctor.log 2>&1
check "TC-OP-02 claude CLI 확인 항목 출력" "1" "$(grep -c 'claude CLI' doctor.log)"
# D8 회귀: 피드 목록 경로는 --feeds 로만 지정한다
check_gt "TC-OP-04 --feeds 로 피드 목록 지정" 0 "$("${NODE_RUN[@]}" feeds list --feeds config/feeds.yaml 2>/dev/null | head -1 | tr -dc '0-9')"
check "TC-OP-04 없는 --feeds 경로는 0개" "0" "$("${NODE_RUN[@]}" feeds list --feeds config/none.yaml 2>/dev/null | head -1 | tr -dc '0-9')"
check_gt "TC-OP-02 불건전 피드 감지" 0 "$(grep -c '불건전 피드' doctor.log)"

printf '\n===============================\n결과: PASS %d / FAIL %d\n샌드박스: %s\n' "$PASS" "$FAIL" "$SANDBOX"
[ "$FAIL" -eq 0 ]
