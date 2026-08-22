---
description: 스터디 폴더의 노트와 이미지를 합쳐 책처럼 읽히는 단일 HTML 학습자료로 만든다
argument-hint: "<폴더명|경로>" [--out <파일>] [--chapters ch1,ch2] [--depth light|full] [--no-verify]
allowed-tools: Agent, Read, Write, Edit, Bash, Glob, Grep
---

# /digest

`study-digest` 스킬을 **오케스트레이터로서** 실행한다. 무거운 작업은 전부 서브에이전트에 넘긴다.

**대상**: `$1` (없으면 현재 작업 중인 스터디 폴더를 추론하고, 애매하면 후보를 보여준 뒤 고르게 한다)
**옵션**: `$ARGUMENTS`

산출물은 대상 폴더가 아니라 **통파일 모음** 한 곳에 만든다.

```bash
VAULT="/Users/imkdw/study/__통파일 모음"
TARGET="/Users/imkdw/study/<대상 폴더>"    # 읽기 전용
SLUG="<슬러그>"                            # 기존 것이 있으면 재사용
DIGEST="$VAULT/.digest/$SLUG"
OUT="$VAULT/$SLUG.html"
ls "$VAULT/.digest"                        # 재빌드인지 신규인지 먼저 확인
mkdir -p "$DIGEST"
```

## 순서

1. `Skill` 툴로 `study-digest` 를 불러 규약을 적재한다.
2. 대상 폴더를 **bash 통계로만** 스캔해 분석 요약을 먼저 보고한다 — 노트 수 / 분량 / 폴더 구성 / 이미지 수 / 코드 언어 분포. 노트 본문을 `cat` 하지 않는다.
3. `digest-outliner` 를 띄워 `$DIGEST` 안에 `meta.json` / `plan.json` / `house-rules.md` 를 만들게 한다.
4. `digest-chapter` 를 챕터당 하나씩, **한 메시지에 3~4개를 묶어 병렬로** 띄운다. 프롬프트는 `DIGEST=` 와 `CH=` 두 줄뿐이다.
5. 묶음이 끝날 때마다 어셈블해 중간 결과를 확인한다.
6. `digest-qa` 로 최종 검수하고, 재집필 지적이 나온 챕터만 4번을 다시 돌린다.
7. `build-index.mjs "$VAULT"` 로 표지 `index.html` 을 다시 만든다. 새 자료면 `$VAULT/index-config.json` 에 카테고리도 한 줄 넣는다.
8. `$DIGEST/reports/*.md` 를 합쳐 최종 보고한다 — 산출물 경로, 커버된 아이템 수, 교정/보강 목록, 확인 못 한 항목.

## 규칙

- 원본 스터디 폴더는 **읽기 전용**이다. 마크다운/이미지를 고치지 않는 것은 물론, 그 안에 `.digest/` 나 `.html` 을 만들지도 않는다.
- 산출물은 HTML **한 파일**. 경로는 `$VAULT/<슬러그>.html`, 빌드 중간물은 `$VAULT/.digest/<슬러그>/`.
- 표지 갱신(7번)은 생략하지 않는다. 빼먹으면 만든 자료가 `index.html` 에 안 뜬다.
- **메인 세션은 노트 본문/이미지/partial HTML/산출물 HTML 을 열지 않는다.** 이걸 어기면 컨텍스트가 터져 중간에 작업이 끊긴다.
- 중간에 멈추지 않는다. 챕터를 나눠 끝까지 완성한 뒤 한 번에 보고한다.
- 서브에이전트 결과가 부실하면 새로 띄우지 말고 `SendMessage` 로 그 에이전트에 보완을 지시한다.
