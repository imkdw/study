---
name: study-digest
description: |
  공부하면서 남긴 마크다운 노트와 스크린샷 이미지를 하나로 합쳐, 책처럼 읽히는 단일 HTML 학습자료로 만든다.
  Pretendard 폰트 + 토스 디자인 시스템 기반 조판, 스크린샷은 멀티모달로 읽어 HTML/SVG/mermaid 컴포넌트로 재현,
  노트의 오류는 공식 문서로 검증해 교정하고 빠진 맥락을 보강한다.
  트리거 - "학습자료 만들어줘", "노트 정리해서 HTML로", "study digest", "정리본 만들어", "책처럼 정리",
  "/digest", 특정 스터디 폴더를 지목하며 "이거 깔끔하게 정리해줘".
---

# study-digest

`/Users/imkdw/study` 아래의 스터디 폴더 하나를 통째로 읽어 **단일 HTML 학습자료**를 만든다.

## 0. 이 스킬이 지키는 것

| 원칙 | 내용 |
| --- | --- |
| 원문 우선 | 사용자의 노트가 뼈대다. 내용을 대체하지 말고 **다듬고 채운다**. |
| 스크린샷 제거 | 이미지는 멀티모달로 읽어 **HTML/SVG/mermaid 로 재현**한다. `<img>` 로 그대로 넣지 않는다. |
| 사실 검증 | 노트에 틀린 서술이 있으면 **공식 문서 기준으로 교정**하고, 교정했다는 사실을 표시한다. |
| 읽는 맛 | 17px / 1.78 / 760px 컬럼. 화려함보다 **가독성**이 우선이다. |
| 단일 파일 | 산출물은 HTML 파일 1개. CSS/JS 는 인라인, 폰트와 라이브러리만 CDN. |

## 1. 파이프라인

```
스캔 → 목차 설계 → 이미지 판독 → 챕터별 집필 → 검증 → 어셈블 → 자체 QA
```

### STEP 1 — 스캔

대상 폴더에서 다음을 뽑는다. 경로에 한글/공백이 있으므로 항상 `find -print0 | xargs -0` 또는 따옴표를 쓴다.

```bash
TARGET="<대상 폴더>"
find "$TARGET" -name '*.md' | sort                       # 노트 목록
find "$TARGET" -name '*.md' -print0 | xargs -0 cat | wc -c # 분량
find "$TARGET" \( -name '*.png' -o -name '*.jpg' \) | sort # 이미지
grep -rn '!\[' --include='*.md' "$TARGET"                 # 이미지 참조 위치
find "$TARGET" -name '*.md' -print0 | xargs -0 grep -ho '^```[a-z]*' | sort | uniq -c
```

파일명이 `숫자. 제목.md` 이면 그 숫자가 아이템 번호, 상위 디렉터리가 챕터다.
분량이 200KB 를 넘으면 챕터 단위로 나눠 작업하되 산출물은 한 파일로 합친다.

### STEP 2 — 목차 설계 (`meta.json`)

작업 디렉터리를 만든다. 기본값은 대상 폴더 안의 `.digest/` 다.

```
<대상 폴더>/.digest/
  meta.json
  partials/ch1.html ...
```

`meta.json` 스키마는 `references/build-format.md` 참고. 여기서 챕터/아이템 id 를 확정하고
이후 partial 은 이 id 를 그대로 쓴다. 어셈블러가 대조해서 어긋나면 경고를 낸다.

### STEP 3 — 이미지 판독

**모든 이미지를 Read 툴로 직접 본다.** 파일명만 보고 추측하지 않는다.
본 다음 `references/visual-language.md` 의 표를 따라 재현 형식을 정한다. 대표적으로

- IDE 호버 툴팁 스크린샷 → `.ide` + `.hovercard` 컴포넌트
- 관계/흐름/계층 → mermaid
- 집합/포함 관계 → 인라인 SVG 벤 다이어그램
- 표 형태 캡처 → `<table>`
- 순수 코드 캡처 → 코드 블록 + 인라인 주석

원본 이미지는 삭제하지 않는다. 산출물에서 참조하지 않을 뿐이다.

### STEP 4 — 챕터별 집필

챕터 하나씩 `partials/<chId>.html` 에 쓴다. 마크업 규칙은 `references/html-components.md`.

각 아이템의 기본 골격:

```html
<article class="item" id="item-7" data-spy>
  <header class="item-head">
    <div class="item-num">ITEM 7</div>
    <h3>타입이 값들의 집합이라고 생각하기</h3>
    <p class="item-tagline">한 줄 요약</p>
  </header>

  <div class="keypoint"><span class="kp-label">핵심</span>가장 중요한 한 문장</div>

  ... 본문 (h4 소제목 / 설명 / 코드 / 다이어그램 / 콜아웃) ...

  <div class="summary">
    <p class="summary-title">정리</p>
    <ul>...</ul>
  </div>
</article>
```

집필 원칙

1. **원문의 소제목 순서를 유지**한다. 사용자가 이해한 흐름이 곧 목차다.
2. 원문의 코드는 **그대로 살린다**. 다만 `// 에러 메시지` 주석은 코드 아래
   `.callout.danger` 로 빼거나 `<span class="err-line">` 으로 강조해 읽기 쉽게 만든다.
3. 나쁜 예 / 좋은 예가 쌍이면 `.code-compare` 로 나란히 놓고 `.code-tag.bad` / `.good` 을 단다.
4. 불릿이 5개를 넘고 항목이 비교 가능하면 **표로 바꾼다**.
5. 원문에 없지만 이해에 필요한 연결 문장은 추가한다. 단, 새 주장은 검증 후에만.
6. 오탈자/오기(`너그럽개`, `타임을`, `직 인터섹션` 같은)는 조용히 고친다.

### STEP 5 — 검증과 보강

`references/fact-check.md` 의 절차를 따른다. 요약하면

- 버전에 민감한 서술(컴파일러 옵션, 표준 동작, API 시그니처)은 **WebSearch/WebFetch 로 공식 문서 확인**
- 노트가 틀렸으면 본문을 고치고 `.callout.warn` 에 `<span class="badge b-red">원문 교정</span>` 표시
- 책 출간 이후 바뀐 것은 `.callout.update` 에 `<span class="badge b-purple">최신 반영</span>` 표시
- 노트에 없지만 실무에서 함께 알아야 할 것은 `.callout.tip` 에 `<span class="badge b-blue">보강</span>` 표시
- 확인 못 한 것은 **쓰지 않는다.** 추측을 단정으로 적지 않는다.

보강은 아이템당 최대 2개. 원문보다 보강이 길어지면 주객이 전도된다.

### STEP 6 — 어셈블

```bash
node "<스킬경로>/assets/assemble.mjs" "<대상 폴더>/.digest" "<대상 폴더>/<이름>.html"
```

경고가 뜨면 meta 와 partial 의 id/순서를 맞춘 뒤 다시 돌린다.

### STEP 7 — 자체 QA

`references/qa-checklist.md` 를 순서대로 확인한다. 최소한 아래는 스크립트로 검사한다.

```bash
OUT="<산출물>"
grep -c '<article class="item"' "$OUT"     # 아이템 수 일치?
grep -o '<img[^>]*>' "$OUT" | head          # 스크린샷 잔존 0 이어야 함
grep -o 'id="item-[0-9]*"' "$OUT" | sort | uniq -d   # 중복 id 없어야 함
node -e 'const h=require("fs").readFileSync(process.argv[1],"utf8");
  const o=(h.match(/<article/g)||[]).length, c=(h.match(/<\/article>/g)||[]).length;
  console.log("article", o, c, o===c?"OK":"MISMATCH");' "$OUT"
```

## 2. 옵션

| 옵션 | 뜻 |
| --- | --- |
| `--out <경로>` | 산출물 경로. 기본값 `<대상 폴더>/<폴더명>.html` |
| `--chapters ch1,ch2` | 일부 챕터만 다시 생성 (partial 만 갈아끼우고 재어셈블) |
| `--no-verify` | 공식 문서 검증 생략 (빠른 초안용) |
| `--depth light\|full` | `light` 는 원문 압축 중심, `full` 은 보강/시각화 적극 (기본 `full`) |

## 3. 자주 하는 실수

- 이미지를 안 보고 캡션만 지어내기 → 반드시 Read 로 본다
- 챕터 partial 에 `<section class="chapter-head">` 를 중복 생성 → 어셈블러가 만든다
- meta 의 `id` 와 partial 의 `id` 불일치 → 어셈블 경고를 무시하지 말 것
- mermaid 안에 백틱/괄호를 그대로 넣어 파싱 실패 → 라벨은 `"..."` 로 감싸고 백틱은 쓰지 않는다
- 다크 모드 미확인 → 하드코딩 색 대신 CSS 변수(`var(--text)` 등)만 쓴다

## 4. 참고 파일

- `references/build-format.md` — meta.json 스키마와 디렉터리 규약
- `references/html-components.md` — 사용 가능한 컴포넌트 마크업 전체
- `references/visual-language.md` — 이미지/개념 → 시각화 형식 매핑
- `references/fact-check.md` — 검증 절차와 표기 규칙
- `references/qa-checklist.md` — 마무리 점검표
- `assets/digest.css`, `assets/digest.js`, `assets/shell.html`, `assets/assemble.mjs`
