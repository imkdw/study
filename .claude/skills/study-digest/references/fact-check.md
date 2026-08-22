# 검증과 보강 규칙

## 1. 언제 확인하는가

노트의 문장이 아래 중 하나에 해당하면 **공식 문서를 확인한 뒤** 쓴다.

- 컴파일러/런타임 옵션의 기본값, 이름, 동작 (`strictNullChecks`, `noImplicitAny`, `--isolatedModules` …)
- 표준 API 시그니처, 반환 타입, 예외 동작
- "~는 불가능하다", "~는 항상 ~다" 같은 단정
- 버전에 따라 달라지는 서술 ("최신 버전에서는", "곧 지원될 예정")
- 성능/복잡도 수치
- 책 집필 시점 이후 문법이 추가된 영역 (TS 라면 `satisfies`, `const` 타입 파라미터, `using` 등)

반대로 **확인 없이 그대로 둬도 되는 것**: 사용자의 이해 방식, 비유, 개인적 코딩 관례, 이미 코드로 증명된 예제.

## 2. 어떻게 확인하는가

우선순위대로

1. 공식 문서 (TypeScript Handbook / Release Notes, MDN, Node.js Docs, 해당 프로젝트 docs)
2. 공식 저장소의 소스/타입 정의 (`lib.es*.d.ts`, RFC, 스펙 문서)
3. 로컬에서 실제로 돌려보기 — 가능하면 이게 가장 확실하다
4. 신뢰할 만한 2차 자료 (메인테이너 블로그 등)

Stack Overflow 답변, 개인 블로그, 오래된 번역 글만으로 단정하지 않는다.

## 3. 어떻게 표기하는가

### 원문이 틀렸을 때

본문은 **맞는 내용으로 고쳐 쓰고**, 바로 아래에 무엇이 어떻게 달랐는지 남긴다.

```html
<div class="callout warn">
  <div class="ic">!</div>
  <div>
    <p class="callout-title">원문 교정 <span class="badge b-red">원문 교정</span></p>
    <p>노트에는 "~라고" 적혀 있지만 실제로는 ~다. (근거: 공식 문서 <a href="...">Xxx</a>)</p>
  </div>
</div>
```

### 책/노트 이후 바뀐 것

```html
<div class="callout update">
  <div class="ic">↑</div>
  <div>
    <p class="callout-title">TypeScript 5.x 기준 <span class="badge b-purple">최신 반영</span></p>
    <p>...</p>
  </div>
</div>
```

### 알아두면 좋은 보강

```html
<div class="callout tip">
  <div class="ic">i</div>
  <div>
    <p class="callout-title">함께 알아두기 <span class="badge b-blue">보강</span></p>
    <p>...</p>
  </div>
</div>
```

## 4. 분량 제한

- 아이템당 교정 콜아웃은 필요한 만큼, **보강 콜아웃은 최대 2개**
- 보강 문단은 3~5줄. 길어지면 별도 아이템이 되어야 할 내용이다
- 근거 링크는 콜아웃당 1개까지. 링크 나열은 하지 않는다

## 5. 확신이 없을 때

- 확인 못 했으면 **쓰지 않는다**
- 조건부로만 참이면 조건을 명시한다 ("`strict` 가 켜져 있을 때에 한해")
- 사용자에게 확인이 필요한 건 마지막 보고에 모아 알린다. 본문에 물음표를 남기지 않는다
