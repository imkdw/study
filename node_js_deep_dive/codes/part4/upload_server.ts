import net from "node:net";
import fs, { WriteStream } from "node:fs";
import path from "node:path";

const PORT = 6060;
const HOST = "::1";

function getTime() {
  return new Date().toLocaleTimeString("ko-KR");
}

const uploaderServer = net.createServer();

uploaderServer.on("connection", (clientSocket) => {
  console.log(`[${getTime()}] 새로운 클라 접속함. IP: ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);

  let fileWriteStream: WriteStream;
  let receivedBytes = 0;

  /**
   * TCP Fragmentation에 대비해서 데이터 누적을 위한 빈 버퍼를 하나 만들어놓음
   */
  let headerBuffer = Buffer.alloc(0);

  const delimiter = "-----BOF-----";

  const onDataForHeader = (chunk: Buffer) => {
    headerBuffer = Buffer.concat([headerBuffer, chunk]);

    const delimiterIndex = headerBuffer.indexOf(delimiter);

    if (delimiterIndex === -1) {
      /**
       * OOM 방어를 위한 로직으로 1024 바이트가 넘도록 구분자가 없다면 악성 요청으로 간주해서 연결 끊어버림
       * 헤더와 파일 데이터가 한 청크로 합쳐져 올 수 있으므로 구분자를 못 찾았을 때만 검사함
       */
      if (headerBuffer.length > 1024) {
        console.log(`[${getTime()}] 악성 데이터 감지함. 헤더 구분자 없음. 소켓 종료함`);
        clientSocket.destroy();
      }
      return;
    }

    console.log(`\n[${getTime()}] '-----BOF-----' 구분자 발견함. 헤더 파싱 시작`);

    /**
     * 버퍼의 맨 처음부터 구분자 시작 위치 전까지 잘라내면 파일명이 나옴
     * 클라가 보낸 값에 경로가 섞여있어도 storage 밖으로 못나가게 순수 파일명만 남김
     */
    const fileName = path.basename(headerBuffer.subarray(0, delimiterIndex).toString("utf-8"));
    console.log(`[${getTime()}] 동적 파일명 파싱 성공: 파일명은 ${fileName} 입니다`);

    /**
     * 이제 헤더 안찾아도 되니까 현재 리스너는 소켓에서 제거함 (해제시킴)
     */
    clientSocket.off("data", onDataForHeader);

    /**
     * 구분자 이후부터 버퍼 끝까지 날라내서 헤더 뒤에 딸려온 진짜 파일 데이터 파편을 추출함
     */
    const remainingData = headerBuffer.subarray(delimiterIndex + delimiter.length);

    /**
     * 추출한 동적 파일명 폴더 경로에 합성해서 쓰기 스트림 만듦
     */
    fileWriteStream = fs.createWriteStream(`./storage/${fileName}`);

    /**
     * 딸려온 파일 데이터 파편이 있으면 쓰기 파이프에 밀어넣어놓음
     */
    if (remainingData.length > 0) {
      fileWriteStream.write(remainingData);
      receivedBytes += remainingData.length;
    }

    process.stdout.write(`[서버 수신 중] ... ${(receivedBytes / (1024 * 1024)).toFixed(2)} MB 저장완료`);

    /**
     * 남은 소켓 데이터를 쓰기 스트림으로 파이프 연결함 (서버쪽 백프레셔 자동화 적용)
     */
    clientSocket.pipe(fileWriteStream);

    /**
     * 첫 헤더 이후에 연달아서 들어오는 후속 청크들을 처리함
     */
    clientSocket.on("data", (subsequentChunk) => {
      receivedBytes += subsequentChunk.length;
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`[서버 수신 중] ... ${(receivedBytes / (1024 * 1024)).toFixed(2)} MB 저장완료`);
    });

    fileWriteStream.on("finish", () => {
      console.log(`\n[${getTime()}] ${fileName} 파일 수신 및 저장 완료. 통신 종료함`);
    });
  };

  clientSocket.on("data", onDataForHeader);

  clientSocket.on("error", (err) => {
    console.log(`[${getTime()}] 에러발생 : ${err.message}`);
  });
});

uploaderServer.listen(PORT, HOST, () => {
  console.log(`[${getTime()}] 서버 실행중 (${HOST}:${PORT})`);
});
