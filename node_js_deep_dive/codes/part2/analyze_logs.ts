import fs from "node:fs/promises";

const RECORD_SEPARATOR = "\n";

console.time("time");

const fileHandleRead = await fs.open("massive_logs.txt", "r");
const fileHandleWrite = await fs.open("filtered_all_errors.txt", "w");

/**
 * encoding 을 주면 스트림 내부의 StringDecoder 가 청크 경계의 멀티바이트 문자를 알아서 이어준다
 * 디코딩을 직접 다뤄보는 버전은 string_decoder.ts 에 있다
 */
const streamRead = fileHandleRead.createReadStream({
  highWaterMark: 64 * 1024,
  encoding: "utf-8",
});

const streamWrite = fileHandleWrite.createWriteStream();

/**
 * 구분자를 아직 만나지 못한 마지막 줄을 다음 청크까지 들고 있는 공간
 */
let leftover = "";

streamRead.on("data", (chunk) => {
  /**
   * 순서가 핵심이다. 이전 청크의 꼬리를 먼저 붙이고 나서 자른다
   * 자른 뒤에 붙이면 이번 청크의 꼬리를 이번 청크의 머리에 붙이는 꼴이 되어 로그가 뒤섞인다
   */
  const logs = (leftover + chunk).split(RECORD_SEPARATOR);

  /**
   * 마지막 요소는 구분자로 끝나지 않았으므로 조건 없이 미완성으로 취급하고 다음 청크로 넘긴다
   * 청크가 정확히 구분자에서 끝났다면 빈 문자열이 들어가니 이 경우도 안전하다
   */
  leftover = logs.pop() ?? "";

  for (const log of logs) {
    if (log.includes("[ERROR]")) {
      if (!streamWrite.write(log + RECORD_SEPARATOR)) {
        streamRead.pause();
      }
    }
  }
});

streamWrite.on("drain", () => {
  streamRead.resume();
});

streamRead.on("end", () => {
  /**
   * 마지막 줄은 개행 없이 끝날 수 있으므로 남은 leftover 를 여기서 처리한다
   */
  if (leftover.includes("[ERROR]")) {
    streamWrite.write(leftover + RECORD_SEPARATOR);
  }

  /**
   * end() 는 "더 쓸 게 없다"는 신호일 뿐이라 아직 버퍼가 남아있을 수 있다
   * 여기서 파일 핸들을 직접 close() 하면 플러시 중인 쓰기와 경합한다
   * 스트림이 autoClose 로 알아서 닫아주니 맡기고, 끝난 시점은 finish 로 확인한다
   */
  streamWrite.end();
});

streamWrite.on("finish", () => {
  console.timeEnd("time");
});
