import net from "node:net";

function formatAddress(server: net.Server): string {
  const addr = server.address();
  if (addr === null) return "(리스닝 중 아님)";
  if (typeof addr === "string") return addr;
  return `${addr.address}:${addr.port}`;
}

const PORT = 4821;
const HOST = "127.0.0.1";

const chatServer = net.createServer();

const activeClients: net.Socket[] = [];

chatServer.on("connection", (userSocket) => {
  console.log(`새 클라이언트가 채팅 서버에 연결됨 (Duplex 스트림)`);

  activeClients.push(userSocket);

  userSocket.on("data", (data) => {
    console.log(data.toString("utf-8"));

    activeClients.forEach((client) => {
      /**
       * 메시지를 보내면 다른 사용자들에게도 메시지를 전송함
       * 이 때 발신자와 다른 경우만 메시지를 발송함
       */
      if (client !== userSocket) {
        client.write(data);
      }
    });
  });

  userSocket.on("end", () => {
    const index = activeClients.indexOf(userSocket);
    if (index !== -1) {
      activeClients.splice(index, 1);
    }
    console.log("클라가 연결 종료해서 메모리에서 제거됨");
  });

  userSocket.on("error", (err) => {
    console.log("클라이언트 통신 오류 발생", err);
  });
});

chatServer.listen(PORT, HOST, () => {
  console.log(`채팅 서버 시작됨: ${formatAddress(chatServer)}`);
});
