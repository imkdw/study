import fs from "node:fs/promises";

(async () => {
  console.time("복사_작업시간");

  /**
   * 큰 파일을 가져오기
   */
  const fileHandleRead = await fs.open("./server_logs.txt", "r");

  /**
   * 데이터를 저장할 새로운 목적지
   */
  const fileHandleWrite = await fs.open("dest.txt", "w");

  /**
   * 읽기 스트림 생성
   */
  const streamRead = fileHandleRead.createReadStream({
    highWaterMark: 64 * 1024, // 65536 바이트로 읽기 스트림 내부 버퍼의 기본값
  });

  /**
   * 쓰기 스트림 생성
   * 쓰기의 경우 내부 버퍼가 16kb임
   */
  const streamWrite = fileHandleWrite.createWriteStream();

  /**
   * 파이프가 꽉 차서 write 메서드가 false를 반환하는데도 계속 데이터를 들이부음
   * 이러한 현상은 안티패턴임
   */
  streamRead.on("data", (chunk) => {
    if (!streamWrite.write(chunk)) {
      /**
       * 만약 쓰기 버퍼가 꽉 차버린 상태라면 잠깐 읽기 스트림을 중지시킴
       * 해당 명령은 OS에게 더 이상 디스크에서 데이터를 읽어오지 말라고 시스템 콜을 보내게됨
       */
      streamRead.pause();
    }
  });

  streamWrite.on("drain", () => {
    /**
     * 쓰기 스트림 내부 버퍼가 비워졌다면 다시 디스크에서 데이터를 읽어오기 위해 명령을 내림
     */
    streamRead.resume();
  });

  streamRead.on("end", () => {
    console.log("모든 데이터 처리 완료");
    streamWrite.end();
    console.timeEnd("복사_작업시간");

    // 모든 데이터 처리 완료
    // 복사_작업시간: 188.583ms
  });
})();
