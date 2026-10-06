import net from "node:net";

const port = 9472;
const hostname = "0.0.0.0";

const server = net.createServer((socket) => {
  socket.write("Hi there!");
  socket.on("data", (data) => console.log(data.toString()));
});

/**
 * 9472번 포트를 바인딩해서 외부에서 접근이 가능하게 만들어줌
 *
 * OS에게 bind()라는 시스템 콜을 날려서 포트 점유를 요청함
 * 이후 커널에선 IP Table 스캔 이후에 실제 내 컴퓨터가 가진 IP 및 유휴 포트를 확인해서 연결을 대기함
 *
 * 이 때 0.0.0.0 이라는 주소도 존재하는데 이는 어떤 종류든 전부 외부에 공개하겠다는 의미임
 *
 */
server.listen(port, hostname, () => {
  console.log(`Server running at ${hostname}:${port}`);
});
