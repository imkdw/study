import fs from "node:fs/promises";

const label = "파일_복사_성능_테스트";

console.time(label);

const inputPath = "source.txt";
const outputPath = "target.txt";

const fileReader = await fs.open(inputPath, "r");
const fileWriter = await fs.open(outputPath, "w");

// 16KB의 버퍼 공간
const CHUNK_SIZE = 16384;

/**
 * 파일을 옮기기 위한 버퍼를 단 하나만 생성해서 무한으로 재사용함
 * 공간복잡도가 O(n)이 아닌 O(1)이 됨
 */
const sharedBuffer = Buffer.alloc(CHUNK_SIZE);

try {
  let readCount = -1;

  while (readCount !== 0) {
    /**
     * 매번 새로운 버퍼를 생성하지 않고 하나의 버퍼를 계속해서 사용함
     */
    const { bytesRead } = await fileReader.read(sharedBuffer, 0, CHUNK_SIZE, null);
    readCount = bytesRead;

    /**
     * EOF(End of File)에 도달했을 경우 반복문을 종료함
     */
    if (readCount === 0) {
      break;
    }

    /**
     * 읽어온 버퍼의 크기만큼 유효한 버퍼를 생성함
     * 16KB라는 고정된 크기에서 마지막에 읽어온 데이터는 16KB보다 작을 수 있음
     * 실제 읽어온 데이터 크기만큼 버퍼를 잘라내고 유효한 값만 하드에 기록함
     */
    const validBuffer = sharedBuffer.subarray(0, readCount);
    await fileWriter.write(validBuffer);
  }
} catch (error) {
  console.error(error);
} finally {
  await fileReader.close();
  await fileWriter.close();
}

console.timeEnd(label);
