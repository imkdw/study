---
name: study-digest
description: |
  공부하면서 남긴 마크다운 노트와 스크린샷 이미지를 하나로 합쳐, 책처럼 읽히는 단일 HTML 학습자료로 만든다.
  Pretendard 폰트 + 토스 디자인 시스템 기반 조판, 스크린샷은 멀티모달로 읽어 HTML/SVG/mermaid 컴포넌트로 재현,
  노트의 오류는 공식 문서로 검증해 교정하고 빠진 맥락을 보강한다.
  목차 설계 / 챕터 집필 / QA 는 서브에이전트에 위임하고 메인은 오케스트레이션만 한다.
  트리거 - "학습자료 만들어줘", "노트 정리해서 HTML로", "study digest", "정리본 만들어", "책처럼 정리",
  "/digest", 특정 스터디 폴더를 지목하며 "이거 깔끔하게 정리해줘".
---

# study-digest

`/Users/imkdw/study` 아래의 스터디 폴더 하나를 통째로 읽어 **단일 HTML 학습자료**를 만든다.
산출물과 빌드 중간물은 **전부 통파일 모음 한 곳**에 모인다. 원본 스터디 폴더에는 아무것도 쓰지 않는다.

## 0. 이 스킬이 지키는 것

| 원칙 | 내용 |
| --- | --- |
| 원문 우선 | 사용자의 노트가 뼈대다. 내용을 대체하지 말고 **다듬고 채운다**. |
| 스크린샷 제거 | 이미지는 멀티모달로 읽어 **HTML/SVG/mermaid 로 재현**한다. `<img>` 로 그대로 넣지 않는다. |
| 사실 검증 | 노트에 틀린 서술이 있으면 **공식 문서 기준으로 교정**하고, 교정했다는 사실을 표시한다. |
| 읽는 맛 | 17px / 1.78 / 760px 컬럼. 화려함보다 **가독성**이 우선이다. |
| 단일 파일 | 산출물은 HTML 파일 1개. CSS/JS 는 인라인, 폰트와 라이브러리만 CDN. |
| 원본 불가침 | 대상 스터디 폴더는 **읽기 전용**. `.digest/` 도 `.html` 도 거기 만들지 않는다. |
| 메인은 지휘만 | 무거운 읽기/쓰기는 전부 서브에이전트가 한다. 아래 §1 이 강제 규칙이다. |

## 0.5. 산출물이 사는 곳 — 통파일 모음

```
/Users/imkdw/study/__통파일 모음/        ← VAULT. 모든 산출물이 여기 모인다
  index.html                            ← 표지. build-index.mjs 가 생성
  <슬러그>.html                          ← 학습자료 (= OUT)
  index-config.json                     ← 표지 카테고리 설정 (선택)
  .digest/<슬러그>/                      ← 이 자료의 빌드 디렉터리 (= DIGEST)
      meta.json  plan.json  house-rules.md
      partials/  reports/
```

모든 스텝에서 아래 세 변수를 먼저 잡고 시작한다.

```bash
VAULT="/Users/imkdw/study/__통파일 모음"
TARGET="/Users/imkdw/study/<스터디 폴더>"   # 읽기 전용
SLUG="<슬러그>"                             # 산출물 파일명 = 빌드 디렉터리명
DIGEST="$VAULT/.digest/$SLUG"
OUT="$VAULT/$SLUG.html"
mkdir -p "$DIGEST"
```

`SLUG` 은 대상 폴더명을 그대로 쓰되 공백/대소문자가 지저분하면 kebab-case 로 다듬는다
(`real mysql 8.0` → `real-mysql-8.0`). **`$VAULT/.digest/` 에 같은 자료가 이미 있으면
그 슬러그를 그대로 재사용한다** — 새로 만들면 표지에 중복 카드가 생긴다.

```bash
ls "$VAULT/.digest"     # 기존 슬러그 확인. 재빌드인지 신규인지 여기서 판단한다
```

## 1. 컨텍스트 예산 — 메인 세션의 금지 사항

이 스킬의 실제 작업량은 메인 컨텍스트에 담기지 않는다. **메인은 다음을 하지 않는다.**

| 금지 | 대신 |
| --- | --- |
| 노트 `.md` 본문 읽기 | `digest-outliner` 가 읽고 `meta.json` / `plan.json` 으로 요약 |
| 이미지 Read (멀티모달) | `digest-chapter` 가 자기 챕터 이미지만 판독 |
| partial HTML 을 직접 작성/열람 | `digest-chapter` 가 파일로 직접 쓴다 |
| 산출물 HTML 통독 | `digest-qa` 가 표본 검사 후 요약만 반환 |
| 검증용 WebSearch/WebFetch | `digest-chapter` 가 자기 챕터 것만 수행 |

메인이 실제로 다루는 것: 파일 **개수/크기 통계**, `meta.json` 의 챕터 골격, 서브에이전트가 돌려주는 **15~20줄 리포트**, 어셈블 명령의 stdout.

`cat` 으로 노트를 열지 마라. `wc`, `find`, `grep -c` 로 세기만 한다.

## 2. 파이프라인

```
스캔(메인) → 목차 설계(outliner) → 챕터 집필(chapter × N, 병렬) → 어셈블(메인) → QA(qa) → 보고(메인)
```

### STEP 1 — 스캔 (메인, bash 만)

경로에 한글/공백이 있으므로 항상 따옴표를 쓴다. `§0.5` 의 변수를 먼저 잡는다.

```bash
find "$TARGET" -name '*.md' | wc -l
find "$TARGET" -name '*.md' -print0 | xargs -0 wc -c | tail -1
find "$TARGET" \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' \) | wc -l
find "$TARGET" -maxdepth 1 -type d | sort
find "$TARGET" -name '*.md' -print0 | xargs -0 grep -ho '^```[a-z]*' | sort | uniq -c | sort -rn | head
```

이 숫자만으로 사용자에게 **분석 요약**을 먼저 보고한다.

### STEP 2 — 목차 설계 → `digest-outliner`

```
Agent(subagent_type: "digest-outliner", prompt:
  TARGET=/Users/imkdw/study/<스터디 폴더>
  DIGEST=/Users/imkdw/study/__통파일 모음/.digest/<슬러그>
  OUT=/Users/imkdw/study/__통파일 모음/<슬러그>.html
  옵션: --depth full          (또는 light / --no-verify)
  meta.json / plan.json / house-rules.md 를 만들고 20줄 이내로 보고해.
)
```

돌아온 리포트를 보고 챕터 구성이 이상하면 **다시 부르지 말고** `SendMessage` 로 그 에이전트에 수정 지시를 보낸다 (컨텍스트가 살아 있어 훨씬 싸다).

메인은 여기서 `meta.json` 의 챕터 목록만 확인한다.

```bash
node -e 'const m=require("<VAULT>/.digest/<슬러그>/meta.json");
  console.log(m.chapters.map(c=>`${c.id} ${c.title} (${(c.items||[]).length})`).join("\n"))'
```

### STEP 3 — 챕터 집필 → `digest-chapter` 병렬

챕터 하나당 에이전트 하나. **한 메시지에 여러 Agent 호출을 넣어 동시에 돌린다.**
한 번에 3~4개씩 묶는다. 그보다 많이 띄우면 웹 검증이 몰려 느려지고, 중간 확인 지점이 사라진다.

```
Agent(subagent_type: "digest-chapter", prompt: "DIGEST=$VAULT/.digest/$SLUG\nCH=ch1")
Agent(subagent_type: "digest-chapter", prompt: "DIGEST=$VAULT/.digest/$SLUG\nCH=ch2")
Agent(subagent_type: "digest-chapter", prompt: "DIGEST=$VAULT/.digest/$SLUG\nCH=ch3")
```

프롬프트는 이 두 줄로 충분하다. 나머지(원문 경로, 이미지 목록, 아이템 id, 문체 계약)는 에이전트가 `plan.json` / `meta.json` / `house-rules.md` 에서 직접 읽는다. **메인이 챕터 내용을 프롬프트에 옮겨 적지 마라.**

각 묶음이 끝나면 파일 존재만 확인하고 다음 묶음을 띄운다.

```bash
ls -la "$DIGEST/partials/"
```

한 챕터가 실패하거나 리포트가 부실하면 그 에이전트에 `SendMessage` 로 보완을 시킨다.

### STEP 4 — 어셈블 (메인)

```bash
node "/Users/imkdw/study/.claude/skills/study-digest/assets/assemble.mjs" \
  "$DIGEST" "$OUT"
```

종료 코드 2 = 경고(빌드는 됨). 경고 내용은 stdout 에 짧게 나오니 메인이 읽어도 된다.

### STEP 5 — QA → `digest-qa`

```
Agent(subagent_type: "digest-qa", prompt:
  OUT=/Users/imkdw/study/__통파일 모음/<슬러그>.html
  DIGEST=/Users/imkdw/study/__통파일 모음/.digest/<슬러그>
)
```

"재집필 필요" 가 나온 챕터만 STEP 3 을 다시 돌린다 (해당 `digest-chapter` 에 `SendMessage`, 없으면 새로 호출).

### STEP 6 — 표지 갱신 (메인)

새 자료가 표지에 뜨게 `index.html` 을 다시 만든다. **매 빌드마다 반드시 돌린다.**

```bash
node "/Users/imkdw/study/.claude/skills/study-digest/assets/build-index.mjs" "$VAULT"
```

`.digest/*/meta.json` 을 훑어 카드를 그린다. 짝이 되는 `<슬러그>.html` 이 없는 빌드
디렉터리는 건너뛰고 경고만 낸다. 카테고리 분류/정렬/색은 `$VAULT/index-config.json`
에서 읽으므로, 새 자료를 추가했으면 거기에 한 줄 넣어준다.

```jsonc
{
  "order":      ["언어/설계", "DB", "인프라", "아키텍처", "AI"],  // 표지 정렬 순서
  "tones":      { "DB": "blue", "인프라": "green" },              // blue|green|purple|yellow|red
  "categories": { "real-mysql-8.0": "DB", "RabbitMQ": "인프라" }   // 슬러그 → 카테고리
}
```

분류가 없으면 "기타" 로 떨어질 뿐 빌드는 깨지지 않는다.

### STEP 7 — 보고 (메인)

리포트 파일을 합쳐서 사용자에게 보여준다. 이건 사용자가 실제로 원하는 내용이라 메인이 읽어도 된다.

```bash
cat "$DIGEST/reports/"*.md
```

보고 항목: 산출물 경로 / 커버한 아이템 수 / 교정/최신/보강 목록 / 확인 못 한 항목 / 판독 실패 이미지.

## 3. 옵션

| 옵션 | 뜻 |
| --- | --- |
| `--out <경로>` | 산출물 경로. 기본값 `<VAULT>/<슬러그>.html`. 웬만하면 쓰지 마라 — 통파일 모음 밖으로 나가면 표지에 안 잡힌다 |
| `--chapters ch1,ch2` | 해당 챕터의 `digest-chapter` 만 다시 띄우고 재어셈블. outliner 는 건너뛴다 |
| `--no-verify` | `plan.json` 의 `verify: false`. 챕터 에이전트가 웹 검증을 생략 |
| `--depth light\|full` | `light` 는 원문 압축 중심, `full` 은 보강/시각화 적극 (기본 `full`) |

옵션은 outliner 프롬프트로 넘기면 `plan.json` 에 박히고, 챕터 에이전트가 알아서 따른다.

## 4. 자주 하는 실수

- **대상 스터디 폴더에 `.digest/` 나 `.html` 만들기** → 산출물은 전부 `$VAULT` 안이다. 원본 폴더는 읽기만 한다
- **STEP 6 표지 갱신을 빼먹기** → 새 자료가 `index.html` 에 안 뜬다
- 기존 자료를 다시 빌드하면서 슬러그를 새로 짓기 → 표지에 카드가 둘 생긴다. `ls "$VAULT/.digest"` 로 먼저 확인
- **메인이 직접 집필하기** → 컨텍스트가 터진다. 챕터는 무조건 서브에이전트로 넘긴다
- 챕터 에이전트에 원문을 프롬프트로 복사해 넣기 → 경로만 주면 알아서 읽는다
- outliner 없이 챕터 에이전트부터 띄우기 → `plan.json` 이 없어 실패한다
- 챕터 partial 에 `<section class="chapter-head">` 중복 생성 → 어셈블러가 만든다
- meta 의 `id` 와 partial 의 `id` 불일치 → 어셈블 경고를 무시하지 말 것
- mermaid 라벨에 `<br>` → 빌더가 textContent 로 읽어 줄바꿈이 사라진다. 라벨은 한 줄로
- mermaid 따옴표 → flowchart 만 따옴표를 벗긴다. sequence/state 는 그대로 찍히니 쓰지 않는다
- 다크 모드 미확인 → 하드코딩 색 대신 CSS 변수(`var(--text)` 등)만 쓴다

## 5. 참고 파일

에이전트별로 읽는 파일이 정해져 있다. **메인은 아래를 읽을 필요가 없다.**

| 파일 | 읽는 주체 |
| --- | --- |
| `references/build-format.md` — meta.json 스키마와 디렉터리 규약 | outliner |
| `references/html-components.md` — 컴포넌트 마크업 전체 | chapter |
| `references/visual-language.md` — 이미지/개념 → 시각화 매핑 | chapter |
| `references/fact-check.md` — 검증 절차와 표기 규칙 | chapter |
| `references/qa-checklist.md` — 마무리 점검표 | qa |
| `assets/digest.css`, `digest.js`, `shell.html`, `assemble.mjs` | 어셈블러(자동) |
| `assets/build-index.mjs` — 통파일 모음 표지 생성기 | 메인 (STEP 6) |

에이전트 정의: `/Users/imkdw/study/.claude/agents/digest-{outliner,chapter,qa}.md`
