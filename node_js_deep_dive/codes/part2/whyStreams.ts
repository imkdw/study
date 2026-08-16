import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";

async function writeManyStreams() {
  console.time("최종_작업시간");

  /**
   * File Handler를 거치지 않고 직접 파일 경로를 지정해서 쓰기 스트림 생성
   * 기본적으로 16KB의 내부 버퍼를 가짐
   */
  const stream = createWriteStream("server_logs.txt");

  for (let i = 0; i < 1_000_000; i++) {
    const data = `[Log] ${i}님의 데이터 처리 완료`;

    /**
     * 스트림 내부 임시 저장소인 버퍼가 꽉 차면 write 메서드가 더 이상 저장할 수 없다고 false를 반환함
     * Stream.Writable.write(chunk: any, callback?: ((error: Error | null | undefined) => void) | undefined): boolean
     *
     * false가 반환되면 해당 순간이 Backpressure가 발생한 순간임
     * 이 때 무작정 데이터를 더 넣는게 아닌 버퍼가 비워질 때 까지 await를 사용해서 잠깐 대기해야함
     * 이는 drain 이벤트로 해당 이벤트가 발생하면 버퍼가 다 비워졌다는 뜻으로 다시 로그 데이터를 붓기 시작함
     *
     * 그래서 메모리가 폭발하지 않고 비동기 방식으로 인해서 메인 스레도 차단되지 않음
     */
    if (!stream.write(data)) {
      /**
       * stream.once는 특정 이벤트 발생시 딱 한번만 실행될 콜백 함수를 등록하는 EventEmitter의 기능
       * 해당 코드에서는 버퍼가 비어졌음을 알리는 drain 이벤트를 감지해서 Promise를 resolve 하는데 사용
       */
      await new Promise<void>((resolve) => stream.once("drain", resolve));
    }
  }

  /**
   * 스트림에 더이상 쓸 데이터가 없으면 해당 메서드를 호출해서 내부적으로 파일 닫기 절차가 시작됨
   */
  stream.end();

  /**
   * 스트림이 완전히 비워지고 종료될 때까지 대기하는 Promise를 반환함
   * stream.end를 호출했다고 해서 즉시 디스크 I/O가 완료되는건 아니라 기다려야함
   */
  await finished(stream);

  // 최종_작업시간: 359.301ms
  console.timeEnd("최종_작업시간");
}

await writeManyStreams();
