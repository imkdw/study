import net from "node:net";
import readline from "node:readline/promises";

const consoleInterface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const SERVER_PORT = 4821;
const SERVER_HOST = "127.0.0.1";

let myClientId: number | null = null;

const chatClient = net.createConnection({ host: SERVER_HOST, port: SERVER_PORT }, async () => {
  console.log("연결 성공");

  while (true) {
    const message = await consoleInterface.question("메시지 입력 > ");

    process.stdout.moveCursor(0, -1);
    process.stdout.clearLine(0);

    if (myClientId) {
      chatClient.write(`${myClientId}-메시지-${message}`);
    }
  }
});

chatClient.on("close", () => {
  console.log("소켓 자원이 램에서 완전히 해제되고 클라이언트가 종료됨");
});

chatClient.on("data", (data) => {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);

  const dataString = data.toString("utf-8");

  if (dataString.startsWith("id-")) {
    myClientId = parseInt(dataString.substring(3));
    console.log(`${myClientId}번 사용자로 등록되었습니다.`);
  } else {
    console.log(dataString);
  }

  process.stdout.write("메시지 입력 > ");
});

chatClient.on("end", () => {
  console.log("서버가 연결 종료를 요청해서 읽기 스트림이 끝에 도달함");
});
