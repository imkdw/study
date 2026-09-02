import fs from "node:fs/promises";

const label = "테스트_파일_생성";
console.time(label);

const fileHandle = await fs.open("source.txt", "w");
const stream = fileHandle.createWriteStream();

const totalLogs = 5_000_000;

for (let i = 0; i < totalLogs; i++) {
  const data = `[LOG] ${i}. 데이터 스트리밍 및 파일 복사 테스트용 더미 텍스트`;

  if (!stream.write(data)) {
    await new Promise<void>((resolve) => stream.once("drain", resolve));
  }
}

stream.end();
await fileHandle.close();

console.timeEnd(label);
