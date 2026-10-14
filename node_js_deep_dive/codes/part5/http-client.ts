import http from "node:http";

const agent = new http.Agent({ keepAlive: true });

const SERVER_HOST = "localhost";
const SERVER_PORT = 7821;

const bodyData = JSON.stringify({ message: "모든 데이터를 한 번에 덩어리로 보냄" });

const request = http.request({
  agent,
  hostname: SERVER_HOST,
  port: SERVER_PORT,
  method: "POST",
  path: "/api/message",
  headers: {
    "content-type": "application/json",
    /**
     * 통신의 규칙을 정의하는 HTTP 헤더의 경우 ASCII 문자만 허용하도록 설계되어있음
     * 가변 멀티바이트 한글이나 이모지 같은걸 그냥 넣으면 실행 자체를 차단해버림
     */
    name: encodeURIComponent("우리동네코딩"),
  },
});

request.end(
  JSON.stringify({
    title: "1st 게시글",
    body: "본문임",
  }),
);

request.on("response", (res) => {
  console.log(`[HTTP ${res.statusCode}]`);
  console.log(res.headers);

  res.on("data", (chunk: Buffer) => {
    const rawData = chunk.toString("utf-8");
    console.log(JSON.parse(rawData));
  });
  res.on("end", () => console.log("전부 수신 완료"));
});
