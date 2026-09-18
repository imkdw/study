# 시각 저장 형식

DB의 시각 컬럼(`articles.created_at`, `articles.published_at`, `feeds.last_fetched_at`, `summaries.created_at`)을 어떤 형식으로 저장할지. PRD 4.5의 파일 이름 규칙(`YYYY-MM-DD`는 발행일, 없으면 수집일)과 "같은 DB로 다시 만들면 같은 이름" 요구에 영향을 준다. T3 REVIEW 메모 3에서 나왔다.

- A: 앱이 모든 시각을 UTC ISO8601(`2026-09-17T15:13:02+00:00`)로 넣는다. `DEFAULT CURRENT_TIMESTAMP`는 쓰지 않는다. 파일 이름 날짜는 T9에서 실행 머신의 로컬 시간대로 변환해 만든다.
- B: 앱이 모든 시각을 로컬 시간대 오프셋이 포함된 ISO8601(`2026-09-18T00:13:02+09:00`)로 넣는다. `published_at`은 수집 시점에 로컬 시간대로 변환해 저장한다. 파일 이름 날짜는 저장된 값의 날짜 부분을 그대로 쓴다.
- C: SQLite `CURRENT_TIMESTAMP`(UTC, 시간대 표기 없음, `2026-09-17 15:13:02`)를 유지하고 `published_at`, `last_fetched_at`도 같은 UTC 형식으로 맞춘다. 파일 이름 날짜는 T9에서 로컬 시간대로 변환한다.

합의: B (시도 1회)

반영 완료: PRD 5절 SQLite 시각 형식 (2026-09-18 planner)
