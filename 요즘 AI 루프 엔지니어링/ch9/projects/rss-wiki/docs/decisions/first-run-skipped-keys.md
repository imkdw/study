# 첫 수집에서 등록하지 않은 글의 재등장 방지 방식

PRD 4.2는 첫 수집 시 피드당 최근 10개만 등록하고, 이후 실행에서 등록하지 않았던 오래된 글이 새 글로 다시 잡히지 않아야 한다고 정한다. 피드는 보통 20개 안팎의 글을 계속 노출하므로, 두 번째 실행에서 11번째 이후 글이 DB에 없다는 이유로 새 글로 등록되는 것을 막을 저장 방식이 필요하다. 스키마(저장 형식)에 닿는 결정이라 합의 절차를 거친다.

- A: `articles.status` CHECK에 `skipped`를 추가하고, 첫 수집에서 상한 밖 글을 `skipped` 상태로 등록한다(본문 없음). 요약/위키/집계 쿼리는 모두 `skipped`를 제외한다. `user_version` 2.
- B: 새 테이블 `skipped_keys(feed_id REFERENCES feeds, key, created_at, PRIMARY KEY (feed_id, key))`에 상한 밖 글의 식별 키만 기록한다. 새 글 판정은 `articles`와 `skipped_keys` 둘 다에 없는 키. `articles`는 그대로. `user_version` 2.
- C: 스키마 변경 없음. 첫 수집 뒤에는 첫 수집 때 등록한 글 중 가장 오래된 `published_at`보다 나중에 발행된 글만 새 글로 본다. 발행일 없는 글은 피드 순서상 이미 아는 키보다 앞에 있을 때만 새 글로 본다.

합의: B (시도 1회)

반영 완료: PRD 4.2 재등장 방지, PRD 5절 `skipped_keys` 테이블 (2026-09-18 planner)
