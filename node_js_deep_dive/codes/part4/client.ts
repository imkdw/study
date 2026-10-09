import net from "node:net";
import readline from "node:readline/promises";

const consoleInterface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const HOST = "127.0.0.1";
const PORT = 4821;

let streamBuffer = "";
let myClientId: null | number = null;

const chatClient = net.createConnection(
  {
    host: HOST,
    port: PORT,
  },
  async () => {
    console.log("연결 성공\n");

    while (true) {
      const message = await consoleInterface.question("메시지를 입력하세요: ");
      process.stdout.moveCursor(0, -1);
      process.stdout.clearLine(0);

      if (myClientId) {
        const messagePacket = { type: "message", id: myClientId, body: message };

        /**
         * 메시지를 보낼 때 구분자를 함께 전송함
         */
        chatClient.write(JSON.stringify(messagePacket) + "\n");
      }
    }
  },
);

chatClient.on("data", (data) => {
  /**
   * 서버랑 완전히 동일한 방식으로 서버에서 흘러들어오는 데이터를 버퍼링함
   */
  streamBuffer += data.toString("utf-8");

  while (streamBuffer.includes("\n")) {
    const newlineIndex = streamBuffer.indexOf("\n");
    const packetString = streamBuffer.substring(0, newlineIndex);
    streamBuffer = streamBuffer.substring(newlineIndex + 1);

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);

    try {
      const packet = JSON.parse(packetString);

      if (packet.type === "identity") {
        myClientId = packet.clientId;
        console.log(`고유 아이디는 ${myClientId}입니다.`);
      } else if (packet.type === "notification") {
        console.log(packet.body);
      } else if (packet.type === "message") {
        console.log(`> ${packet.id}번 사용자: ${packet.body}`);
      }
    } catch (error) {
      console.log("데이터 패킷 파싱 에러", error);
    }
  }
});

chatClient.on("end", () => {
  console.log(`\n서버가 연결을 끊었습니다.`);
  process.exit(0);
});

chatClient.on("error", (error) => {
  console.log("\n채팅 클라이언트 에러", error);
  process.exit(1);
});
