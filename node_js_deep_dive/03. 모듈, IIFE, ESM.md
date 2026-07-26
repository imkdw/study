## 모듈

- 모듈은 시스템을 설계하고 구동하는 절대적인 최소 단위
- Node.js 생태계에서 모듈은 더 이상 쪼갤 수 없는 하나의 모듈임. 즉 1파일 = 1모듈임
- 브라우저에서 js를 로딩할 때 같은 변수명을 가졌다면 마지막에 불러온걸 덮어씌움
  - 브라우저는 불러온 여러 파일을 하나의 거대한 파일처럼 합쳐서 실행함
  - 이런 문제를 Global Scope Pollution 이라고 부름

<br>

### Global Scope Pollution

- 자바스크립트에는 함수 스코프의 법칙이 존재하는데 이는 함수 내부 변수가 외부로 나갈 수 없다는 법칙임
- 이렇게 하면 변수의 스코프 오염은 막을 수 있지만 같은 함수명은 막을 방법이 없었음
- 그래서 이름조차 남기지 않고 코드가 실행하고 완벽하게 사라지는 방법이 필요했음
- 이런 함수를 IIFE(즉시 실행 함수)라고 부르는데 이는 함수가 정의되자마자 실행하고 사라짐

```ts
// IIFE 함수
(function () {
  const name = "동우";
  console.log(name); // 동우
});

console.log(name); // ReferenceError: name is not defined
```

<br>

### Node.js가 Global Scope Pollution을 해결한 방법

- Node.js의 경우 초창기에 위 같은 IIFE 방식을 적극적으로 활용함
- Node.js를 통해 자바스크립트 파일을 실행하면 V8 엔진에 넘기기 전에 몰래 IIFE 껍데기를 씌움
- 이 때 일부 예제코드를 보면 `require`, `__filename`, `module` 등 정의하지 않은 기능을 자유롭게 사용함
- 이는 자바스크립트의 글로벌 기능이 아닌 Node.js가 매개변수 파라미터 자리에 필수 파라미터를 채워서 제공해주는 방식임

```ts
/**
 * 모듈이 실행되기 직전에 Node.js 시스템이 백그라운드에서 필수 도구를 사전에 미리 생성함
 */
const 미리_만든_module = { exports: {} };
const 미리_만든_exports = 미리_만든_module.exports;
const 미리_만든_require = function (path) {};
const 미리_만든_filename = "filename";

/**
 * 작성한 파일을 불러오고 거기에 껍데기를 씌워서 거대한 익명 함수로 감쌈
 */
(function (exports, require, filename) {
  const fs = require("fs");
  console.log(`현재 파일 경로: ${__filename}`);
})(미리_만든_exports, 미리_만든_require, 미리_만든_filename);
```

<br>

### require

- 파일을 불러오는거 말고도 더 안전한 기능을 제공함
- 경로를 제공하면 알려준 주소에 찾아가서 코드를 안전한 상자인 IIFE에 담아서 실행시킴
- 그 상자안에 존재하는 결과를 `module.exports`에 넘겨줌
- 이런 방식이 Node.js의 생태계를 지켜온 IIFE 래퍼 함수의 핵심이자 캡슐화의 원리임

<br>

### ESM

- 과거에는 CommonJS 방식을 사용했지만 현재는 ESM(ECMAScript Modules) 방식을 사용함
- 세대가 변해도 필요한 기능만 외부로 주입하거나 내보낸다는 모듈성의 원리는 전혀 변하지 않음
- 단지 도구가 IIFE + require에서 공식 지원인 import + export로 바뀌었을뿐임
- `package.json` 내부에 `type: 'module'`을 적어서 해당 모듈을 ESM으로 사용한다고 명시가 가능함

<br>

### ESM 예제

```ts
const password = "외부 유출 금지";

/**
 * Named Export 방식
 * 여러 개의 기능을 각각 내보낼 때 사용
 */
export function printMesage(message) {
  console.log(`[System] ${message}`);
}
export const version = "1.0.0";

/**
 * Default Export 방식
 * 이 파일의 가장 대표적인 기능 하나만 딱 내보낼 떄 사용
 */
export default function initializeLogger() {
  console.log("Logger System Initialized");
}
```

```ts
/**
 * Named Export : 중괄호 내부에서만 로딩 가능
 * Default Export : 괄호 불필요
 */
import initializeLogger, { printMesage, version } from "./app";

initializeLogger();
printMesage(`ESM v${version}`);
```

<br>

## ESM

### 중복된 모듈명 회피하기

- as(alias) 키워드를 통해서 같은 모듈을 다른 이름으로 회피할 수 있음
- 즉 중복된 이름을 내 맘대로 바꿀 수 있는 기능임
- export의 경우도 as 사용이 가능함

```ts
import { getInfo as getAppleinfo } from "apple.js";
import { getInfo as getBananainfo } from "banana.js";

getappleInfo();
getBananaInfo();
```

<br>

### 와일드카드

- export 하는 기능이 10개 이상 존재하는 등 경우는 named import 하기가 힘듬
- 그래서 `import * as Tools from './tool.js'` 형태로 가져올 수 있음

<br>

### Barrel 개념

- 실무 프로젝트에선 수십 개의 모듈 파일이 존재하는데 매번 이들을 외우고 가져오는건 힘듦
- 그래서 `index.js` 같은 입구 전용 파일을 만들어서 모든 부품을 한곳에서 모아서 내보내는 방식을 사용할 수 있음
-
