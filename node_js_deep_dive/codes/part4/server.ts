import net from "node:net";

const PORT = 4821;
const HOST = "127.0.0.1";
const chatServer = net.createServer();

const activeClients = new Map();
let nextClientId = 1;

chatServer.on("connection", (userSocket) => {
  console.log(`새로운 클라이언트 접속. ${userSocket.remoteAddress}:${userSocket.remotePort}`);

  const clientId = nextClientId++;

  /**
   * 특정 유저를 위해 고유하게 존재하는 버퍼 저장소를 메모리에 할당함
   */
  let streamBuffer = "";

  const identityPacket = { type: "identity", clientId };

  /**
   * 메시지를 보낼 때 구분자를 함께 전송함
   */
  userSocket.write(JSON.stringify(identityPacket) + "\n");

  const joinPacket = { type: "notification", body: `> 안내: ${clientId}번 사용자가 채팅방에 입장` };

  /**
   * 메시지를 보낼 때 구분자를 함께 전송함
   */
  activeClients.forEach((client) => client.write(JSON.stringify(joinPacket) + "\n"));
  activeClients.set(clientId, userSocket);

  userSocket.on("data", (data) => {
    /**
     * 데이터를 수신하면 일단 유저마자 할당된 버퍼 공간에 데이터를 이어붙임
     */
    streamBuffer += data.toString("utf-8");

    /**
     * OOM을 방지하기 위해서 유저 버퍼의 공간이 1MB를 초과하면 소켓을 종료함
     */
    if (streamBuffer.length > 1024 * 1024) {
      console.log(`[경고] ${clientId}번 사용자의 버퍼 크기가 1MB를 초과했습니다.`);
      userSocket.destroy();
      return;
    }

    /**
     * 버퍼 내부에 \n 구분자가 존재하는 한, 즉 완성된 패킷이 있는 동안 계속해서 루프를 돌게됨
     */
    while (streamBuffer.includes("\n")) {
      /**
       * 제일 먼저 등장하는 구분자의 인덱스를 찾음
       */
      const newlineIndex = streamBuffer.indexOf("\n");

      /**
       * 버퍼의 처음부터 구분자가 등장하는 위치까지 잘라서 완벽한 JSON을 만들어냄
       */
      const packetString = streamBuffer.substring(0, newlineIndex);

      /**
       * 추출한 부분 제외하고 다시 버퍼에 저장함
       */
      streamBuffer = streamBuffer.substring(newlineIndex + 1);

      try {
        const packet = JSON.parse(packetString);

        if (packet.type === "message") {
          console.log(`[${packet.id}번 사용자]: ${packet.body}`);
          const boardcastPacket = { type: "message", id: packet.id, body: packet.body };

          /**
           * 브로드캐스팅시 까먹지 말고 구분자 붙이기
           */
          activeClients.forEach((client) => client.write(JSON.stringify(boardcastPacket) + "\n"));
        }
      } catch (error) {
        console.log("데이터 패킷 파싱 에러", error);
      }
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
