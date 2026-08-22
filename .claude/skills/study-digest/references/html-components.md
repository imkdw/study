# 컴포넌트 마크업 사전

`digest.css` 가 제공하는 클래스 전부. **여기 없는 클래스는 만들지 않는다.**
색은 반드시 CSS 변수를 쓴다. 하드코딩하면 다크 모드에서 깨진다.

---

## 1. 아이템 골격

```html
<article class="item" id="item-7" data-spy>
  <header class="item-head">
    <div class="item-num">ITEM 7</div>
    <h3>타입이 값들의 집합이라고 생각하기</h3>
    <p class="item-tagline">타입은 문법이 아니라 "할당 가능한 값의 집합"이다.</p>
  </header>
  ...
</article>
```

소제목은 `h4`, 그 아래는 `h5`. `h1`/`h2`/`h3` 은 표지/챕터/아이템 전용이라 본문에서 쓰지 않는다.

## 2. 핵심 한 줄

```html
<div class="keypoint">
  <span class="kp-label">핵심</span>
  extends, 할당 가능, 서브타입은 모두 <b>부분집합</b>이라는 한 단어의 다른 이름이다.
</div>
```

아이템당 최대 1개. 두 개 이상 쓰면 강조가 죽는다.

## 3. 코드 블록

```html
<div class="code">
  <div class="code-head">
    <div class="code-dots"><i></i><i></i><i></i></div>
    <span class="code-file">app.ts</span>
    <span class="code-tag bad">이렇게 쓰면 안 됨</span>   <!-- 선택: bad | good -->
    <span class="code-spacer"></span>
  </div>
<pre><code class="language-typescript">const x: number = 12;</code></pre>
</div>
```

- `<pre>` 는 **줄바꿈 없이 바로** 시작한다. 앞에 개행이 들어가면 첫 줄이 빈 줄로 보인다.
- 코드 안의 `<` `>` `&` 는 반드시 이스케이프(`&lt;` `&gt;` `&amp;`)한다. 제네릭에서 자주 실수한다.
- 복사 버튼은 JS 가 자동으로 붙인다. 직접 넣지 않는다.
- 언어 클래스: `language-typescript` / `language-javascript` / `language-json` / `language-bash`

### 줄 강조

```html
<pre><code class="language-typescript">const a: AB = "A";
<span class="err-line">const c: AB = "C";</span></code></pre>
```

`err-line`(빨강) / `ok-line`(초록). 강조된 줄은 하이라이터를 타지 않으므로
문법 강조가 필요하면 `<span class="hljs-keyword">` 등을 직접 쓰거나 강조를 포기한다.

### 나쁜 예 / 좋은 예 비교

```html
<div class="code-compare">
  <div class="code">
    <div class="code-head"><div class="code-dots"><i></i><i></i><i></i></div>
      <span class="code-tag bad">문제</span><span class="code-spacer"></span></div>
<pre><code class="language-typescript">...</code></pre>
  </div>
  <div class="code">
    <div class="code-head"><div class="code-dots"><i></i><i></i><i></i></div>
      <span class="code-tag good">개선</span><span class="code-spacer"></span></div>
<pre><code class="language-typescript">...</code></pre>
  </div>
</div>
```

## 4. IDE 호버 카드 — 스크린샷 대체

VSCode 툴팁 캡처는 전부 이걸로 바꾼다.

```html
<div class="ide">
  <div class="ide-body">
<pre><span class="hljs-keyword">function</span> <span class="hljs-title">restOfPath</span>(path: <span class="hljs-type">string</span>) {
  <span class="hljs-keyword">return</span> path.split(<span class="hljs-string">"/"</span>).<span class="ide-hover-anchor">slice</span>(<span class="hljs-number">1</span>).join(<span class="hljs-string">"/"</span>);
}</pre>
    <div class="hovercard">
      <div class="hovercard-sig">(method) <span class="typ">Array</span>&lt;<span class="typ">string</span>&gt;.<span class="fn">slice</span>(start?: <span class="typ">number</span>, end?: <span class="typ">number</span>): <span class="typ">string</span>[]</div>
      <div class="hovercard-doc">배열의 일부를 얕게 복사해 새 배열로 반환한다.</div>
    </div>
  </div>
  <div class="ide-caption">split 이 <code>string[]</code> 를 돌려주므로 slice 도 <code>Array&lt;string&gt;</code> 의 메서드로 추론된다.</div>
</div>
```

hovercard 안에서 쓰는 토큰 클래스: `.kw`(키워드) `.typ`(타입) `.str`(문자열) `.fn`(함수) `.prop`(속성) `.num`(숫자) `.dim`(흐린 글자).
`ide-body` 안에서는 `hljs-*` 클래스도 그대로 쓸 수 있다.

에러 물결 밑줄: `<span class="squiggly">city.toUppercase</span>` (빨강) / `squiggly-warn` (노랑).

## 5. 콜아웃

```html
<div class="callout tip">
  <div class="ic">i</div>
  <div>
    <p class="callout-title">보강 <span class="badge b-blue">보강</span></p>
    <p>본문</p>
  </div>
</div>
```

| 종류 | 용도 | ic 글자 |
| --- | --- | --- |
| `tip` | 보충 설명, 실무 팁 | `i` |
| `warn` | 함정, 주의, 원문 교정 | `!` |
| `danger` | 컴파일 에러 / 런타임 에러 메시지 | `×` |
| `success` | 권장 패턴, 결론 | `✓` |
| `update` | 책 출간 이후 바뀐 내용 | `↑` |

콜아웃 안에 코드 블록/리스트를 넣어도 된다. 마지막 요소의 아래 여백은 자동으로 제거된다.

## 6. 요약 카드

```html
<div class="summary">
  <p class="summary-title">정리</p>
  <ul>
    <li>...</li>
  </ul>
</div>
```

아이템 끝에 하나. 원문에 `# 요약` 이 있으면 그 내용을 여기로 옮긴다.

## 7. 표

```html
<div class="table-wrap">
  <table>
    <thead><tr><th>구분</th><th>type</th><th>interface</th></tr></thead>
    <tbody>
      <tr><td>선언 병합</td><td class="t-center t-no">✗</td><td class="t-center t-ok">✓</td></tr>
    </tbody>
  </table>
</div>
```

`.table-wrap` 없이 `<table>` 만 쓰면 좁은 화면에서 가로로 터진다. 항상 감싼다.

## 8. 다이어그램

### mermaid

```html
<div class="figure">
  <div class="figure-body">
    <pre class="mermaid">
flowchart LR
  A["소스 .ts"] --> B["타입 체크"]
  A --> C["트랜스파일"]
  C --> D["출력 .js"]
    </pre>
  </div>
  <div class="figure-cap"><b>타입 체크와 트랜스파일은 독립적이다</b> — 타입 에러가 있어도 .js 는 나온다.</div>
</div>
```

mermaid 주의사항
- 노드 라벨은 항상 큰따옴표로 감싼다: `A["string | number"]`
- 라벨 안에서 백틱, 대괄호, 중괄호는 피한다. 줄바꿈은 `<br>`
- 테마는 JS 가 다크/라이트에 맞춰 다시 렌더한다. `%%{init}%%` 를 직접 쓰지 않는다.

### 인라인 SVG (집합/벤 다이어그램 등)

```html
<div class="figure">
  <div class="figure-body">
    <svg viewBox="0 0 420 200" width="420" role="img" aria-label="설명">
      <circle cx="165" cy="100" r="80" class="venn-a"/>
      <circle cx="255" cy="100" r="80" class="venn-b"/>
      <circle cx="165" cy="100" r="80" class="venn-a-s"/>
      <circle cx="255" cy="100" r="80" class="venn-b-s"/>
      <text x="120" y="105" class="dg-text dg-mono" font-size="13" text-anchor="middle">A</text>
    </svg>
  </div>
  <div class="figure-cap">...</div>
</div>
```

SVG 안에서 쓸 클래스: `dg-fill-bg` `dg-fill-soft` `dg-stroke` `dg-text` `dg-text-sub` `dg-mono` `dg-accent`
`venn-a` `venn-b` `venn-a-s` `venn-b-s`. **fill/stroke 를 인라인 속성으로 하드코딩하지 않는다.**
`viewBox` 는 필수, `width` 는 최대 640 이하.

## 9. 단계 목록

```html
<ol class="steps">
  <li><div class="step-title">tsc 가 파싱한다</div><p>설명</p></li>
  <li><div class="step-title">타입을 체크한다</div><p>설명</p></li>
</ol>
```

## 10. 뱃지 / 태그

```html
<span class="badge">기본</span>
<span class="badge b-blue">보강</span>
<span class="badge b-red">원문 교정</span>
<span class="badge b-green">권장</span>
<span class="badge b-purple">최신 반영</span>

<div class="tag-row">
  <span class="badge">strictNullChecks</span>
  <span class="badge">noImplicitAny</span>
</div>
```

## 11. 강조

- `<b>` / `<strong>` — 굵게
- `<em>` — 노란 형광펜 효과. 한 문단에 1개까지
- 인라인 코드는 `<code>` 그대로 쓰면 자동 스타일

## 12. 쓰지 말 것

- `<img>` (스크린샷 재현이 원칙)
- `style="..."` 인라인 스타일 (다크 모드에서 깨짐)
- `<h1>` `<h2>` `<h3>` (구조 전용)
- 새로운 클래스명 (CSS 에 없으면 무스타일)
