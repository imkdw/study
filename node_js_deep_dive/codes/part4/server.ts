import net from "node:net";

const PORT = 4821;
const HOST = "127.0.0.1";
const chatServer = net.createServer();

const activeClients = new Map();
let nextClientId = 1;

chatServer.on("connection", (userSocket) => {
  console.log(`새로운 클라이언트 접속. ${userSocket.remoteAddress}:${userSocket.remotePort}`);

  const clientId = nextClientId++;

  const identityPacket = { type: "identity", clientId };

  userSocket.write(JSON.stringify(identityPacket));

  const joinPacket = { type: "notification", body: `> 안내: ${clientId}번 사용자가 채팅방에 입장` };

  activeClients.forEach((client) => client.write(JSON.stringify(joinPacket)));
  activeClients.set(clientId, userSocket);

  userSocket.on("data", (data) => {
    try {
      const dataString = data.toString("utf-8");
      const packet = JSON.parse(dataString);

      if (packet.type === "message") {
        console.log(`[${packet.id}번 사용자]: ${packet.body}`);

        const boardcastPacket = { type: "message", id: packet.id, body: packet.body };

        activeClients.forEach((client) => client.write(JSON.stringify(boardcastPacket)));
      }
    } catch (error) {
      console.log("데이터 패킷 파싱 에러", error);
    }
  });

  userSocket.on("end", () => {
    activeClients.delete(clientId);
    console.log(`${clientId}번 사용자가 채팅방에서 나감`);

    const leavePacket = { type: "notification", body: `> 안내: ${clientId}번 사용자가 채팅방에서 나감` };
    activeClients.forEach((client) => client.write(JSON.stringify(leavePacket)));
  });

  userSocket.on("error", (error) => {
    console.log(`${clientId}번 사용자 소켓 에러`, error);
  });
});

chatServer.listen(PORT, HOST, () => {
  console.log(`채팅 서버가 ${HOST}:${PORT}에서 실행 중`);
});
