import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";

const inputPath = "source.txt";
const outputPath = "target.txt";

const readStream = createReadStream(inputPath);
const writeStream = createWriteStream(outputPath);

try {
  await pipeline(readStream, writeStream);
  console.log("데이터 파이프라인 처리 완료");
} catch (err) {
  console.error("데이터 파이프라인 처리 중 오류 발생", err);
}
