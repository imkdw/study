import fs from "node:fs/promises";

(async () => {
  console.time("시간");

  const fileHandle = await fs.open("messive_logs.txt", "w");
  const stream = fileHandle.createWriteStream();

  const totalLogs = 10_000_000;

  for (let i = 0; i < totalLogs; i++) {
    const logType = i % 2 === 0 ? "INFO" : "ERROR";
    const message = logType === "INFO" ? "데이터 처리 완료" : "네트워크 오류 발생";

    const data = `[${logType}] 식별자 ${i} - ${message}  `;

    if (!stream.write(data)) {
      await new Promise<void>((resolve) => stream.once("drain", resolve));
    }
  }

  stream.end();

  console.timeEnd("시간");
})();
