import net from "node:net";

/**
 * HTTP 서버에 순수 TCP 연결을 시도함
 */
const socket = net.createConnection({ host: "localhost", port: 7821 }, () => {
  console.log("서버와 TCP 연결이 성공적으로 수립되었습니다.");

  /**
   * V8 힙메모리가 아닌 컴퓨터의 물리적 Off Heap 메모리 공간에 4바이트 할당
   */
  const reqBuffer = Buffer.alloc(4);

  reqBuffer[0] = 99;
  reqBuffer[1] = 88;

  /**
   * 서버에 데이터 발송
   */
  socket.write(reqBuffer);
});

socket.on("data", (chunk: Buffer) => {
  console.log("--------- 수신된 서버 응답 ---------");
  console.log(chunk.toString("utf-8"));
  socket.destroy();
});

socket.on("end", () => {
  console.log("TCP 연결이 종료되었습니다.");
});
