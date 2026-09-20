import { open } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { TransformCallback } from "stream";

function getCurrentPercentage(processedBytes: number, totalFileSize: number) {
  return Math.min(Math.floor((processedBytes / totalFileSize) * 100), 100);
}

interface Options {
  totalFileSize: number;
}

class SmartCipherEngine extends Transform {
  private readonly totalFileSize: number;
  private processedBytes: number = 0;
  private loggedPercentage: number = 0;

  constructor({ totalFileSize }: Options) {
    super();
    this.totalFileSize = totalFileSize;
  }

  /**
   * 이전의 _read, _write 처럼 직접 호출하는 메서드가 아님
   * Readable 이후에 데이터를 받을 준비가 완료된 순간 Node.js가 알아서 호출
   */
  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    /**
     * 카이사르 암호화 알고리즘(시프트 연산)을 적용함
     * 이 때 성능을 위해서 데이터를 복제해서 진행하지 않고 in-place mutation 최적화를 적용함
     * 수 MB 파일을 다룰때 매번 새로운 공간을 할당하면 메모리 차지가 심해지고 GC가 계속해서 돌게됨
     *
     * 또한 Buffer의 경우 Uint8Array를 사용하는데 이는 Wrap-Around 특성을 지님
     * overflow, underflow를 자체적으로 순환하는데 255 + 1 = 0 / 0 - 1 = 255 형식임
     */
    for (let i = 0; i < chunk.length; ++i) {
      chunk[i] = chunk[i] + 1;
    }

    this.processedBytes = chunk.length;

    const currentPercentage = getCurrentPercentage(this.processedBytes, this.totalFileSize);

    /**
     * console.log 자체도 CPU 자원을 사용함
     * 암호화같은 CPU 집약적 작업을 할때는 터미널에 출력하는 로그도 최적화가 필요함
     * 현재 퍼센트가 이전에 출력한 퍼센트보다 큰 경우만 출력해서 압축률이 상승되는것만 로그로 보여줌
     */
    if (currentPercentage > this.loggedPercentage) {
      console.log(`대용량 파일 암호화 진행률 : ${currentPercentage}%`);
      this.loggedPercentage = currentPercentage;
    }

    /**
     * 암호화된 데이터를 Transform 내부 읽기 큐로 안전하게 저장함
     * 이후에 Writeable 파이프를 통해서 디스크에 저장하는 형태로 동작함
     */
    callback(null, chunk);
  }
}

class SmartDecipherEngine extends Transform {
  private readonly totalFileSize: number;
  private processedBytes: number = 0;
  private loggedPercentage: number = 0;

  constructor({ totalFileSize }: Options) {
    super();
    this.totalFileSize = totalFileSize;
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    /**
     * 암호화랑 다르게 +1이 아닌 -1을 수행
     */
    for (let i = 0; i < chunk.length; ++i) {
      chunk[i] = chunk[i] - 1;
    }

    this.processedBytes += chunk.length;
    const currentPercentage = getCurrentPercentage(this.processedBytes, this.totalFileSize);

    if (currentPercentage > this.loggedPercentage) {
      console.log(`대용량 파일 복호화 진행률 : ${currentPercentage}%`);
      this.loggedPercentage = currentPercentage;
    }

    callback(null, chunk);
  }
}

async function runEncryptionPipeline() {
  console.time("pipe");

  const sourceFilePath = "read_source.txt";
  const targetFilePath = "encrypted_destination.txt";

  const readHandle = await open(sourceFilePath, "r");
  const { size: totalFileSize } = await readHandle.stat();
  const writeHandle = await open(targetFilePath, "w");

  const readStream = readHandle.createReadStream();
  const writeStream = writeHandle.createWriteStream();

  const cipherEngine = new SmartCipherEngine({ totalFileSize });

  console.log(`총 ${(totalFileSize / 1024 / 1024).toFixed(2)} MB 데이터 암호화 시작`);

  try {
    await pipeline(readStream, cipherEngine, writeStream);
    console.log(`종료됨`);
  } catch (error) {
    console.log("에러남", error);
  } finally {
    await readHandle.close();
    await writeHandle.close();
    console.timeEnd("pipe");
  }
}

async function runDecryptionPipeline() {
  console.time("pipe");

  const sourceFilePath = "encrypted_destination.txt";
  const targetFilePath = "derypted_destination.txt";

  const readHandle = await open(sourceFilePath, "r");
  const { size: totalFileSize } = await readHandle.stat();
  const writeHandle = await open(targetFilePath, "w");

  const readStream = readHandle.createReadStream();
  const writeStream = writeHandle.createWriteStream();

  const decipherEngine = new SmartDecipherEngine({ totalFileSize });

  console.log(`총 ${(totalFileSize / 1024 / 1024).toFixed(2)} MB 데이터 복호화 시작`);

  try {
    await pipeline(readStream, decipherEngine, writeStream);
    console.log(`종료됨`);
  } catch (error) {
    console.log("에러남", error);
  } finally {
    await readHandle.close();
    await writeHandle.close();
    console.timeEnd("pipe");
  }
}

await runEncryptionPipeline();
await runDecryptionPipeline();
