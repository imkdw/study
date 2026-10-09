import net from "node:net";
import readline from "node:readline/promises";

const consoleInterface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const HOST = "127.0.0.1";
const PORT = 4821;

let myClientId: null | number = null;

const chatClient = net.createConnection(
  {
    host: HOST,
    port: PORT,
  },
  async () => {
    console.log("연결 성공");

    while (true) {
      const message = await consoleInterface.question("메시지를 입력하세요: ");

      process.stdout.moveCursor(0, -1);
      process.stdout.clearLine(0);

      if (myClientId) {
        const messagePacket = { type: "message", id: myClientId, body: message };
        chatClient.write(JSON.stringify(messagePacket));
      }
    }
  },
);

chatClient.on("data", (data) => {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);

  try {
    const dataString = data.toString("utf-8");
    const packet = JSON.parse(dataString);

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
});

chatClient.on("end", () => {
  console.log(`\n서버가 연결을 끊었습니다.`);
  process.exit(0);
});

chatClient.on("error", (error) => {
  console.log("\n채팅 클라이언트 에러", error);
  process.exit(1);
});
