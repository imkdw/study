import net from "node:net";
import readline from "node:readline/promises";

/**
 * stdin은 키보드를 통해서 들어오는 OS의 표주 입력 스트림을 의미함
 * stdout은 모니터 화면에 글자를 그려주는 표준 출력 스트림을 의미함
 * 리눅스/유닉스 기반의 OS에서는 이를 File Descriptor 0, 1번으로 관리하게됨
 *
 * readline 모듈은 OS 레벨의 표준 입출력 스트림과 연결해서 입력값을 빨아드리는 역할을 수행함
 */
const consoleInterface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const SERVER_PORT = 4821;
const SERVER_HOST = "127.0.0.1";

const chatClient = net.createConnection({ host: SERVER_HOST, port: SERVER_PORT }, async () => {
  console.log("연결 성공");

  while (true) {
    /**
     * await를 사용하면 CPU를 멈추는 블록킹 상태가 아니며 libuv를 통해서 다른 백그라운드 작업을 처리함
     * OS에게 키보드 입력 버퍼인 stdin 내부에 데이터를 모아두다가 enter가 입력되면 다음으로 넘어감
     */
    const message = await consoleInterface.question("메시지 입력 > ");

    /**
     * 바이너리로 인코딩해서 전송 계층으로 넘김
     * OS는 이를 TCP Segment로 쪼개고 랜 카드에 밀어넣어서 서버를 향해서 전송함
     *
     */
    chatClient.write(message);
  }
});

chatClient.on("close", () => {
  console.log("소켓 자원이 램에서 완전히 해제되고 클라이언트가 종료됨");
});

/**
 * 서버에서 브로드캐스팅된 데이터 출력
 */
chatClient.on("data", (data) => {
  /**
   * 원래 떠있는 `메시지 입력 >`을 없앰
   */
  process.stdout.clearLine(0);

  /**
   * 터미널 커서를 활용해서 해당 줄의 맨 앞으로 이동시킴
   */
  process.stdout.cursorTo(0);

  /**
   * 충돌 없이 깨긋해진 줄에 서버로부터 온 메시지를 출력함
   */
  console.log(`신규 메시지 : ${data.toString("utf-8")}`);

  /**
   * 출력이 끝나면 다시 입력을 받기 위해서 프롬프트를 화면에 그림
   */
  process.stdout.write("메시지 입력 > ");
});

chatClient.on("end", () => {
  console.log("서버가 연결 종료를 요청해서 읽기 스트림이 끝에 도달함");
});
