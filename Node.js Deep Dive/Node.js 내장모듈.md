## Path : 경로 탐색

### 서버 프로그램의 특징

- 서버 프로그램 개발시 각 OS마다 폴더 구조가 다른데 하드코딩하면 에러가 발생할 수 있음
- 서버프로그램은 다양한 OS에서 배포되고 실행되어야 하므로 항상 이러한 경로 문제를 보장해줘야함

<br>

### Path 모듈 사용 예시

```ts
// node: 접두사를 붙이면 node.js 내장 모듈을 뜻함
import path from "node:path";

const currentFolder = import.meta.dirname;

// OS에 맞게 폴더의 파일 이름을 안전하게 이어 붙임
const safePath = path.join(currentFolder, "assets", "images", "profile.png");

// 현재 폴더: /Users/imkdw/study/Node.js Deep Dive
// 안전한 경로: /Users/imkdw/study/Node.js Deep Dive/assets/images/profile.png
console.log(`현재 폴더: ${currentFolder}`);
console.log(`안전한 경로: ${safePath}`);
``;
```

<br>

## OS 모듈 : 서버 진단

- 서버의 자원을 실시간으로 모니터링이 가능함. 즉 시스템의 건강 상태 진단이 가능한 모듈임

<br>

### 예시

```ts
import os, { totalmem } from "node:os";
const osType = os.type();
const osRelease = os.release();
const uptime = os.uptime();

// OS: Darwin
// Version: 25.5.0
// 업타임 : 1364434
console.log(`OS: ${osType}`);
console.log(`Version: ${osRelease}`);
console.log(`업타임 : ${uptime}`);

const cpu = os.cpus();
const totalMemory = os.totalmem();
const freeMemory = os.freemem();

const totalGb = (totalMemory / 1024 / 1024 / 1024).toFixed(2);
const freeGb = (totalMemory / 1024 / 1024 / 1024).toFixed(2);

// CPU 코어: 10
// 총 메모리: 16.00
// 여유 메모리: 16.00
console.log(`CPU 코어: ${cpu.length}`);
console.log(`총 메모리: ${totalGb}`);
console.log(`여유 메모리: ${freeGb}`);
```

<br>

## fs : 파일시스템

- file system의 약자로 파일을 일고, 생성하고, 수정하고, 삭제하는 모든 권한을 가진 내장 모듈
- 웹에서 동작하는 자바스크립트는 철저한 보안정책(샌드박스)으로 인해서 절대 파일시스템을 볼 수 없음

<br>

### 파일 쓰기

```ts
import fs from "node:fs";
import path from "node:path";

const currentFolder = import.meta.dirname;
const filePath = path.join(currentFolder, "message.txt");

fs.writeFileSync(filePath, "파일에 동기적으로 저장하는 writeFileSync");

console.log("파일 생성 성공");
```

<br>

### 파일 읽기 예제

- readFileSync 메서드 두번째 인자가 매우 중요함
- 컴퓨터는 모두 0, 1 2개의 바이너리 데이터로 존재함
- 이 파일을 가져올 때 Binary -> N 으로 변환할 때 사용하는 인코딩 방식을 적용해야함

```ts
import fs from "node:fs";
import path from "node:path";

const currentFolder = import.meta.dirname;
const filePath = path.join(currentFolder, "message.txt");

const fileContent = fs.readFileSync(filePath, "utf-8");

console.log(`읽어온 내용: ${fileContent}`);
```

<br>

### 파일시스템 주의점

- 디스크에 접근하는건 아주 느린 연산임
- 많은 사용자가 접근하는 서버에서 동기 연산을 처리하면 블로킹되어 서버가 다운되버리고 말것임
- 이처럼 무거운 연산을 위해서 버퍼, 스트림 등 다양한 해결법이 존재함

<br>

## events, eventEmitter : 이벤트 기반 아키텍처

- 자바스크립트는 근본적으로 한번에 한개의 작업만 처리 가능한 싱글스레드 언어임
- 이러한 치명적인 문제를 해결하기 위해서 Node.js가 채택한 아키텍처가 Event-Driven 아키텍처임
- 이 때 가장 핵심적인 부품이 이벤트 모듈의 `EventEmitter`임.

<br>

### 예제

```ts
import EventEmitter from "node:events";

// 이벤트를 방출하는 인스턴스 생성
const myEmitter = new EventEmitter();

// 이벤트 리스너를 등록
// orderComplete 이벤트가 오면 무엇을 할지 미리 정의함
myEmitter.on("orderComplete", () => console.log("주문 처리 완료"));

console.log("주문을 접수하고 다른 손님의 주문을 받는중");

// 이벤트 발생시키기
// 주문이 완료되어서 orderComplete 이벤트를 발생시킴
myEmitter.emit("orderComplete");

// 주문을 접수하고 다른 손님의 주문을 받는중
// 주문 처리 완료
```

<br>

### 실무코드 예제

```ts
import EventEmitter from "node:events";

const serverEmitter = new EventEmitter();

// once는 서버의 초기 설정이 완료되었거나, 중복해서 실행되면 안 되는 민감한 작업에 필수로 사용됨
serverEmitter.once("userLogin", (username, ip) => {
  console.log(`[보안] ${username}님이 최초로 로그인함. (IP: ${ip})`);
});

serverEmitter.on("dataReceived", (dataSize) => {
  console.log(`[통신] ${dataSize} 바이트의 데이터를 수신`);
});

// once로 선언된 userLogin 이벤트는 1번만 실행됨
serverEmitter.emit("userLogin", "김동우", "1.1.1.1");
serverEmitter.emit("userLogin", "김동우", "1.1.1.1");

serverEmitter.emit("dataReceived", 1024);
serverEmitter.emit("dataReceived", 2048);

// [보안] 김동우님이 최초로 로그인함. (IP: 1.1.1.1)
// [통신] 1024 바이트의 데이터를 수신
// [통신] 2048 바이트의 데이터를 수신
```

<br>

## HTTP : 인터넷 통신 규약

- Node.js의 HTTP 모듈은 컴퓨터의 물리적 네트워크 포트를 열고 HTTP 요청을 받을 수 있음
- 포트를 통해서 요청이 들어오면 그 순간에 스레드가 동작하게됨
- 그래서 자바스크립트 + HTTP 모듈을 통해서 실제 웹 서버 구현이 가능함

<br>

### 예제

```ts
import http from "node:http";

// 웹 서버 객체 생성
const server = http.createServer();

// 서버 객체는 내부적으로 EventEmitter 방식임. 그래서 connection 이벤트를 구독함
// 해당 이벤트는 그저 접속한 순감을 감지하는 아주 raw-level의 알림임
server.on("connection", (socket) => console.log(`새로운 유저 접속`));

// 서버를 특정 포트에서 대기시킴
server.listen(9000);

// 서버가 9000 포트에서 대기중
// 새로운 유저 접속
console.log(`서버가 9000 포트에서 대기중`);
```

<br>

### 복잡한 예제

- req에는 요청 정보가 담겨있으며, res는 응답을 보낼때 사용함
- 인터넷을 통해서 날아가는 데이터는 단순하고 안전한 형태여야하는데 문자열이나 JSON이 이에 속함
- 단 실제 API 서버를 구축할때는 HTTP 모듈을 그대로 사용하는게 아닌 express, nest.js 등 프레임워크를 사용함. 이는 HTTP 모듈을 래핑한것임

```ts
import http from "node:http";

const server = http.createServer((req, res) => {
  // 메인 페이지 요청 처리
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.write("ㅎㅇ");
    res.end();
  }

  // API 요청 처리
  if (req.url === "/api/courses") {
    // DB에서 가져왔다고 가정함
    const mockCourses = [1, 2, 3];

    res.writeHead(200, { "content-type": "application/json" });
    res.write(JSON.stringify(mockCourses));
    res.end();
  }
});

server.listen(9000);
console.log("서버가 9000 포트에서 대기중");
```

<br>
