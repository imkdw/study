# 빌드 디렉터리 규약

```
<대상 폴더>/.digest/
  meta.json
  partials/
    ch1.html
    ch2.html
    ...
```

어셈블러는 `meta.json` 으로 **사이드바 / 표지 / 챕터 헤더**를 만들고,
`partials/*.html` 은 **아이템 본문만** 담는다. 챕터 헤더를 partial 에 또 쓰면 중복된다.

## meta.json

```jsonc
{
  "title": "이펙티브 타입스크립트",          // 사이드바 상단 + 표지 h1 + <title>
  "subtitle": "62 items 정리",              // 사이드바 부제
  "mark": "TS",                             // 좌상단 사각 로고 글자 (1~2자)
  "eyebrow": "STUDY DIGEST",                // 표지 상단 pill
  "description": "메타 description",
  "lead": "표지 리드 문단. <b>HTML 허용</b>.",
  "coverNote": "<div class=\"callout tip\">...</div>",  // 표지 추가 블록(선택, HTML)
  "footer": "출처 표기 등. HTML 허용",
  "stats": [
    { "val": "62", "unit": "개", "label": "아이템" },
    { "val": "8",  "unit": "개", "label": "챕터" }
  ],
  "chapters": [
    {
      "id": "ch1",                       // 앵커 id. data-spy 대상
      "short": "CH 1",                   // 사이드바 뱃지 + 표지 카드 라벨
      "navTitle": "타입스크립트 알아보기", // 사이드바/카드용 짧은 제목 (없으면 title)
      "title": "타입스크립트 알아보기",     // 챕터 헤더 h2
      "lead": "챕터 도입 문단. HTML 허용",
      "file": "ch1.html",                // 기본값 "<id>.html"
      "items": [
        { "id": "item-1", "idx": "1", "title": "타입스크립트와 자바스크립트의 관계",
          "keywords": "슈퍼셋 superset 타입체커 런타임" }
      ]
    }
  ]
}
```

### 필드 규칙

- `id` 는 문서 전체에서 **유일**해야 한다. 아이템은 `item-<번호>` 를 권장.
- `idx` 는 사이드바에 회색 번호로 붙는다. 번호 체계가 없으면 생략.
- `keywords` 는 검색 전용. 영문 원어/약어/동의어를 넣어두면 검색이 잘 붙는다.
- `lead`, `coverNote`, `footer`, `stats[].label` 은 HTML 이 그대로 들어간다. 나머지는 이스케이프된다.

## partial 파일

`<article class="item" id="..." data-spy>` 들의 나열. 그 밖의 래퍼는 두지 않는다.

```html
<article class="item" id="item-1" data-spy>
  ...
</article>

<article class="item" id="item-2" data-spy>
  ...
</article>
```

`data-spy` 가 있어야 스크롤 스파이(사이드바 활성 표시, 상단 breadcrumb)가 작동한다.
챕터 헤더도 어셈블러가 `data-spy` 를 붙여준다.

## 실행

```bash
node .claude/skills/study-digest/assets/assemble.mjs "<대상>/.digest" "<대상>/out.html"
```

종료 코드 2 = 경고 있음(빌드는 됨). meta 와 partial 의 id 집합/순서를 맞춰라.
