import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Transform } from "node:stream";
import { createBrotliCompress, createDeflate, createGzip } from "node:zlib";

async function createDummyFile(filePath: string) {
  const LABEL = "1GB_더미_텍스트_파일_생성";
  console.log(`${LABEL} 시작`);
  console.time(LABEL);

  const writeStream = createWriteStream(filePath);

  const chunk = Buffer.alloc(1024 * 1024, "A");

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

async function maesureCompression(algoName: string, transformFilter: Transform, inputFile: string, extension: string) {
  const outputFile = `compressed_${algoName}_${extension}`;
  console.log(`${algoName} 파이프라인 가동중..`);
  console.time(`${algoName} 소요시간`);

  try {
    await pipeline(createReadStream(inputFile), transformFilter, createWriteStream(outputFile));
  } catch (error) {
    console.error(`${algoName} 파이프라인 오류: ${error}`);
    return;
  }

  console.timeEnd(`${algoName} 소요시간`);

  const originalSize = (await stat(inputFile)).size;
  const compressedSize = (await stat(outputFile)).size;

  const originalMB = (originalSize / (1024 * 1024)).toFixed(2);
  const compressedMB = (compressedSize / (1024 * 1024)).toFixed(2);
  const ratio = (((originalSize - compressedSize) / originalSize) * 100).toFixed(4);

  console.log(`${algoName} 압축률: ${ratio}%`);
  console.log(`${algoName} 원본 파일 크기: ${originalMB}MB`);
  console.log(`${algoName} 압축 파일 크기: ${compressedMB}MB`);
  console.log(`${algoName} 압축 파일 크기: ${compressedSize} bytes`);
  console.log(`${algoName} 원본 파일 크기: ${originalSize} bytes`);
  console.log("=".repeat(50));
}

(async () => {
  const TARGET_FILE = "dummy_1gb.txt";

  await createDummyFile(TARGET_FILE);

  console.log(`벤치마크 시작`);

  // gzip 파이프라인 가동중..
  // gzip 소요시간: 1.625s
  // gzip 압축률: 99.9028%
  // gzip 원본 파일 크기: 1024.00MB
  // gzip 압축 파일 크기: 1.00MB
  // gzip 압축 파일 크기: 1043658 bytes
  // gzip 원본 파일 크기: 1073741824 bytes
  // ==================================================
  // deflate 파이프라인 가동중..
  // deflate 소요시간: 1.543s
  // deflate 압축률: 99.9028%
  // deflate 원본 파일 크기: 1024.00MB
  // deflate 압축 파일 크기: 1.00MB
  // deflate 압축 파일 크기: 1043646 bytes
  // deflate 원본 파일 크기: 1073741824 bytes
  // ==================================================
  // brotli 파이프라인 가동중..
  // brotli 소요시간: 10.815s
  // brotli 압축률: 99.9998%
  // brotli 원본 파일 크기: 1024.00MB
  // brotli 압축 파일 크기: 0.00MB
  // brotli 압축 파일 크기: 1681 bytes
  // brotli 원본 파일 크기: 1073741824 bytes
  // ==================================================
  await maesureCompression("gzip", createGzip(), TARGET_FILE, "gz");
  await maesureCompression("deflate", createDeflate(), TARGET_FILE, "deflate");
  await maesureCompression("brotli", createBrotliCompress(), TARGET_FILE, "br");
})();
