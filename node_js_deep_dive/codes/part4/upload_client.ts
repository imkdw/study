import net from "node:net";
import fs from "node:fs";
import path from "node:path";

/**
 * 프로세스 실행 시 터미널에서 넘겨받은 인자 배열 중 3번째 값을 추출함
 */
const targetFilePath = process.argv[2];

if (!targetFilePath) {
  console.log(`[에러] 업로드할 파일 경로 입력해`);
  console.log(`[사용법] node upload_client.ts <파일주소>`);
  process.exit(1);
}

const PORT = 6060;
const HOST = "::1";

function getTime() {
  return new Date().toLocaleTimeString("ko-KR");
}

const uploaderClient = net.createConnection(
  {
    port: PORT,
    host: HOST,
  },
  async () => {
    console.log(`[${getTime()}] 서버랑 연결 성공함`);

    /**
     * 터미널로 입력받은 전체 경로에서 순수 파일명 + 확장자만 추출함
     */
    const fileName = path.basename(targetFilePath);

    /**
     * 서버와 클라이언트칸 약속된 구분자를 정하고 이를 사용해서 구분을 진행함
     * 이 때 일반적으로 파일에서는 안나올법한 문자열을 사용해야함
     * 아래 BOF는 Beginning Of File의 약자임
     */
    const header = `${fileName}-----BOF-----`;
    uploaderClient.write(header);

    const fileReadStream = fs.createReadStream(targetFilePath);
    let uploadedBytes = 0;

    fileReadStream.on("data", (chunk) => {
      uploadedBytes += chunk.length;
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`\r[클라 전송 중] ... ${(uploadedBytes / (1024 * 1024)).toFixed(2)} MB 전송완료`);
    });

    fileReadStream.on("end", () => {
      console.log(`\n[${getTime()}] 파이프라인을 통한 파일 전체 전송 성공`);
    });

    fileReadStream.on("error", (err) => {
      console.log(`[${getTime()}] 에러 발생 : ${err.message}`);
    });

    /**
     * 기존 백프레셔 제어 & 드레이닝을 자동화하는 파이프를 연결함
     *
     * pipeline을 사용하면 중간에 발생하는 데이터 유실 등을 모두 처리해주지만 여기서는 pipe를 사용함
     * 여기서는 N개의 스트림이 엮인게 아닌 서버 + 클라이언트 오직 2개만 존재함
     */
    fileReadStream.pipe(uploaderClient);
  },
);

uploaderClient.on("connect", () => {
  console.log(`서버 접속 완료 : ${HOST}:${PORT}`);
});
