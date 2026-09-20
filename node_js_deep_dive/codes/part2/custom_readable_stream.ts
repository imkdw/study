import { close, open, read } from "node:fs";
import Stream, { Readable } from "node:stream";

interface SmartDiskReaderOptions {
  highWaterMark: number;
  sourceFileName: string;
}

export class SmartDiskReader extends Readable {
  private readonly sourceFileName: string;
  private fd: number | null;

  constructor({ highWaterMark, sourceFileName }: SmartDiskReaderOptions) {
    super({ highWaterMark });

    this.sourceFileName = sourceFileName;
    this.fd = null;
  }

  /**
   * Node.js에서 자동으로 호출하는 초기화 메서드
   * 파일 오픈 이후에 클래스 자체에 fd 저장
   */
  _construct(callback: (error?: Error | null) => void): void {
    open(this.sourceFileName, "r", (error, fd) => {
      if (error) {
        callback(error);
      } else {
        this.fd = fd;
        callback();
      }
    });
  }

  _read(size: number): void {
    /**
     * 램에 데이터 저장을 위한 공간 할당
     * Buffer.alloc은 zero-fill을 수행하는데 여기선 해당 작업을 처리하지 않음
     * 극한의 성능을 위한 작업으로 일단 만들고 내부는 모두 디스크에서 읽은 데이터로 채움
     * 이후에 subarray를 통해서 불필요한 데이터 전부 잘라냄
     */
    const tempBuffer = Buffer.allocUnsafe(size);

    if (this.fd) {
      /**
       * 위에서 생성한 임시 버퍼에다가 데이터를 처음부터 끝까지 담아달라고 OS에 요청함
       * read 함수 5번째 인자(position)에 null을 전달했는데 이유는 아래와 같음
       * OS 커널이 자체적으로 관리하는 파일 오프셋 포인터를 자동으로 전진시켜서 루프를 돌아감
       * 이후에 순차적으로 데이터를 읽어와서 실제 데이터를 버퍼에 담음
       */
      read(this.fd, tempBuffer, 0, size, null, (error, bytesRead) => {
        if (error) {
          return this.destroy(error);
        }

        /**
         * 실제 읽어온 데이터가 실제로 존재하는지 꼭 검사해야함
         * else 블록의 경우 EOF로 판별함
         */
        if (bytesRead > 0) {
          /**
           * 남은 빈 공간을 잘라낼 때 메모리를 복제하는게 아닌 가벼운 뷰만 생성함
           * Buffer.allocUnsafe와 결합되어 퍼포먼스 최적화의 끝판왕임
           */
          const actualData = tempBuffer.subarray(0, bytesRead);
          this.push(actualData);
        } else {
          this.push(null);
        }
      });
    }
  }

  /**
   * OS에 fd 반납
   */
  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    if (this.fd !== null) {
      close(this.fd, (closeError) => {
        callback(closeError || error);
      });
    } else {
      callback(error);
    }
  }
}

console.time("Custom Stream Read Time");
const stream = new SmartDiskReader({
  highWaterMark: 1024 * 64,
  sourceFileName: "high_performance_output.txt",
});

let totalChunks = 0;
let totalBytes = 0;

stream.on("data", (chunk) => {
  ++totalChunks;
  totalBytes += chunk.length;
});

stream.on("end", () => {
  // 데이터 읽기 완료
  // - CHUNK 쪼개기 횟수 : 16384회
  // - 읽은 용량 : 1024.00 MB
  // Custom Stream Read Time: 197.68ms
  console.log("데이터 읽기 완료");
  console.log(`- CHUNK 쪼개기 횟수 : ${totalChunks}회`);
  console.log(`- 읽은 용량 : ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.timeEnd("Custom Stream Read Time");
});
