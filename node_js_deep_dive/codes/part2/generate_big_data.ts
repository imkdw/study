import { createWriteStream } from "node:fs";

const LABEL = "1GB_더미_텍스트_파일_생성";
async function createDummyFile(filePath: string) {
  console.log(`${LABEL} 시작`);
  console.time(LABEL);

  const writeStream = createWriteStream(filePath);

  /**
   * 1MB 크기의 버퍼를 생성하면서 알파벳 A로 가득 채움
   */
  const chunk = Buffer.alloc(1024 * 1024, "A");

  /**
   * 1MB 청크를 1024번 써서 총 1GB
   */
  for (let i = 0; i < 1024; i++) {
    const canWrite = writeStream.write(chunk);
    if (!canWrite) {
      await new Promise<void>((resolve) => writeStream.once("drain", resolve));
    }
  }

  writeStream.end();

  await new Promise<void>((resolve) => writeStream.on("finish", resolve));

  console.timeEnd(LABEL);
  console.log(`${LABEL} 완료`);
}

await createDummyFile("1GB_더미_텍스트_파일.txt");
