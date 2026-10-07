import net from "node:net";

function formatAddress(server: net.Server): string {
  const addr = server.address();
  if (addr === null) return "(리스닝 중 아님)";
  if (typeof addr === "string") return addr;
  return `${addr.address}:${addr.port}`;
}

interface ActiveClient {
  id: number;
  socket: net.Socket;
}

const PORT = 4821;
const HOST = "127.0.0.1";

const chatServer = net.createServer();

const activeClients: ActiveClient[] = [];
let nextClientId = 1;

chatServer.on("connection", (userSocket) => {
  console.log(`새로운 클라이언트가 접속함. 원격 IP : ${userSocket.remoteAddress}, 포트 : ${userSocket.remotePort}`);

  const clientId = nextClientId++;

  activeClients.push({ id: clientId, socket: userSocket });

  userSocket.write(`id-${clientId}`);

  userSocket.on("data", (data) => {
    const dataString = data.toString("utf-8");

    /**
     * 문자열 내에서 구분자 태그가 시작되는 인덱스 번호 찾기
     */
    const idEndIndex = dataString.indexOf("-메시지-");

    if (idEndIndex !== -1) {
      const senderId = dataString.substring(0, idEndIndex);
      const message = dataString.substring(idEndIndex + 5);

      console.log(`[${senderId}번 사용자 - 포트 ${userSocket.remotePort}에서] ${message}`);

      activeClients.forEach((client) => {
        client.socket.write(`> ${senderId}번 사용자:  ${message}`);
      });
    }
  });

  userSocket.on("end", () => {
    const index = activeClients.findIndex((client) => client.socket === userSocket);
    if (index !== -1) {
      activeClients.splice(index, 1);
    }
    console.log(`${clientId}번 사용자(포트 ${userSocket.remotePort})가 연결을 종료함`);
  });

  userSocket.on("error", (err) => {
    console.log(`${clientId}번 사용자(포트 ${userSocket.remotePort})가 오류 발생: ${err.message}`);
  });
});

chatServer.listen(PORT, HOST, () => {
  console.log(`채팅 서버 시작됨: ${formatAddress(chatServer)}`);
});
