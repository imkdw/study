import fs from "node:fs/promises";

(async () => {
  const fileHandle = await fs.open("server_logs.txt", "w");
  const stream = fileHandle.createWriteStream();

  // 내부 버퍼의 최대 크기 (기본 16kb)
  // 출력: 최대 수위: 65536
  console.log(`최대 수위: ${stream.writableHighWaterMark}`);

  // 내부 버퍼에 차있는 데이터 크기 (초기는 0)
  // 현재 크기: 0
  console.log(`현재 크기: ${stream.writableLength}`);

  const buffData = "test data";
  console.log(Buffer.byteLength(buffData)); // 9
  const buff = Buffer.from("test data", "utf-8");
  stream.write(buff);

  // 데이터 쓰기 후 양 : 9
  console.log(`데이터 쓰기 후 양 : ${stream.writableLength}`);

  await fileHandle.close();
})();
