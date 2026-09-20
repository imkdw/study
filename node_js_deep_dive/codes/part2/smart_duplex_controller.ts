import { close, open, read, write } from "node:fs";
import { Duplex } from "node:stream";

interface Options {
  readableHighWaterMark: number;
  writableHighWaterMark: number;
  readSourcePath: string;
  writeDestinationPath: string;
}

class SmartDuplexController extends Duplex {
  private readonly readSourcePath: string;
  private readonly writeDestinationPath: string;
  private readFd: number | null;
  private writeFd: number | null;
  private ramBuffer: Buffer[] = [];
  private bufferedBytes: number = 0;
  private ioReadCount: number = 0;
  private ioWriteCount: number = 0;

  constructor({ readableHighWaterMark, writableHighWaterMark, readSourcePath, writeDestinationPath }: Options) {
    super({ readableHighWaterMark, writableHighWaterMark });

    this.readSourcePath = readSourcePath;
    this.writeDestinationPath = writeDestinationPath;
    this.readFd = null;
    this.writeFd = null;
  }

  _construct(callback: (error?: Error | null) => void): void {
    open(this.readSourcePath, "r", (readError, readFd) => {
      if (readError) {
        return callback(readError);
      }

      this.readFd = readFd;

      open(this.writeDestinationPath, "w", (writeError, writeFd) => {
        if (writeError) {
          return callback(writeError);
        }

        this.writeFd = writeFd;
        callback();
      });
    });
  }

  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    /**
     * 데이터를 바로 디스크에 저장하는게 아닌 우선 램에 저장
     * 이후에 버퍼된 크기가 쓰기 스트림 버퍼의 크기보다 커지면 OS에 저장 호출을 진행
     * 아래와 같은 로직은 stream._writev(chunks, callback) 훅 메서드가 코어에도 존재함
     */
    this.ramBuffer.push(chunk);
    this.bufferedBytes += chunk.length;

    if (this.bufferedBytes > this.writableHighWaterMark && this.writeFd !== null) {
      {
        /**
         * Buffer.concat의 경우 디스크 저장을 위한 시스템 콜 횟수를 엄청나게 줄여줌
         * 하지만 N개의 버퍼를 메모리상에 모아뒀다가 데이터를 한 번 복사하는 미세한 비용이 있음
         * 이 때 OS 레벨의 Scatter/Gather I/O를 통해서 더 극한의 최적화가 가능함
         *
         * 이는 concat과 다르게 데이터 복제없이 데이터가 어딨는지 메모리 주소들의 목록만 건네줌
         * 커널에 해당 주소를 보고 흩어진 공간을 찾아가서 단 한번의 디스크 I/O로 처리해버림
         * stream_writev + fs.writev 조합을 통해서 메모리 복사 비용없이 N개의 버퍼 조각을 한번에 쓰기 연산이 가능함
         */
        write(this.writeFd, Buffer.concat(this.ramBuffer), (error) => {
          if (error) {
            return callback(error);
          }

          this.ramBuffer = [];
          this.bufferedBytes = 0;
          ++this.ioWriteCount;
          callback();
        });
      }
    } else {
      /**
       * 아직 램에 모으는 중이면 즉시 callback 을 호출해서 다음 chunk 를 받는다
       * 여기서 callback 을 빼먹으면 스트림이 첫 write 에서 영구 정지한다
       */
      callback();
    }
  }

  _read(size: number): void {
    const tempBuffer = Buffer.allocUnsafe(size);

    if (this.readFd) {
      read(this.readFd, tempBuffer, 0, size, null, (error, bytesRead) => {
        /**
         * 기타 사유로 데이터 읽기 과정에서 오류가 발생하면 파이프 자체를 파괴시킴
         */
        if (error) {
          return this.destroy(error);
        }

        if (bytesRead > 0) {
          const actualData = tempBuffer.subarray(0, bytesRead);
          ++this.ioReadCount;
          this.push(actualData);
        } else {
          this.push(null);
        }
      });
    }
  }

  /**
   * 명시적으로 end() 호출하면 해당 메서드가 호출됨
   */
  _final(callback: (error?: Error | null) => void): void {
    if (this.bufferedBytes > 0 && this.writeFd !== null) {
      {
        /**
         * 마지막 데이터 조각을 전부 저장하고 파이프라인을 초기화시킴
         */
        write(this.writeFd, Buffer.concat(this.ramBuffer), (error) => {
          if (error) {
            return callback(error);
          }

          this.ramBuffer = [];
          this.bufferedBytes = 0;
          ++this.ioWriteCount;
          callback();
        });
      }
    } else {
      callback();
    }
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    console.log("듀얼 엔진 하드웨어 벤치마크");
    console.log(`물리적 Read IO : ${this.ioReadCount}`);
    console.log(`물리적 Write IO : ${this.ioWriteCount} `);

    const closeWriteDescriptor = (readCloseError: NodeJS.ErrnoException | null) => {
      if (this.writeFd !== null) {
        /**
         * 파일 디스크립터 반납 시스템 콜
         */
        close(this.writeFd, (writeCloseError) => {
          callback(readCloseError || writeCloseError || error);
        });
      } else {
        callback(readCloseError || error);
      }
    };

    if (this.readFd !== null) {
      close(this.readFd, (readCloseError) => closeWriteDescriptor(readCloseError));
    } else {
      closeWriteDescriptor(null);
    }
  }
}

console.time("Duplex");

const duplex = new SmartDuplexController({
  readableHighWaterMark: 1024 * 64,
  writableHighWaterMark: 1024 * 64,
  readSourcePath: "read_source.txt",
  writeDestinationPath: "write_destination.txt",
});

let currentIndex = 0;
const MAX_WRITE_COUNT = 100_000;
let totalChunks = 0;

const executeWriting = () => {
  while (currentIndex < MAX_WRITE_COUNT) {
    const chunk = Buffer.from(`듀얼 엔진 쓰기 테스트 ${currentIndex} \\n`, "utf-8");

    if (currentIndex === MAX_WRITE_COUNT - 1) {
      return duplex.end(chunk);
    }

    const canKeepWriting = duplex.write(chunk);

    if (!canKeepWriting) {
      break;
    }

    ++currentIndex;
  }
};

executeWriting();

// [WRITE] 모든 데이터 쓰기 완료
// [READ] 모든 데이터 읽기 완료 : 16384회
// 듀얼 엔진 하드웨어 벤치마크
// 물리적 Read IO : 16384
// 물리적 Write IO : 60
// 자원 반납 종결
// Duplex: 239.314ms
duplex.on("drain", () => executeWriting());
duplex.on("data", (chunk) => ++totalChunks);
duplex.on("end", () => console.log(`[READ] 모든 데이터 읽기 완료 : ${totalChunks}회`));
duplex.on("finish", () => console.log(`[WRITE] 모든 데이터 쓰기 완료`));
duplex.on("close", () => {
  console.log(`자원 반납 종결`);
  console.timeEnd("Duplex");
});
