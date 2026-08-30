import fs from "node:fs/promises";
import { StringDecoder } from "node:string_decoder";

const SOURCE_PATH = "massive_logs.txt";
const TARGET_PATH = "filtered_errors.txt";

const RECORD_SEPARATOR = "\n";

/**
 * 한 줄이 이 길이를 넘으면 구분자가 없는 파일을 읽고 있다고 판단한다
 * 이 방어가 없으면 개행 없는 1GB 파일을 만났을 때 leftover 가 무한히 커져서 OOM 으로 죽는다
 */
const MAX_LINE_LENGTH = 1024 * 1024;

interface LogRecord {
  timestamp: string;
  level: string;
  id: number;
  message: string;
}

/**
 * 로그 한 줄의 형식을 통째로 검증한다
 * 기존처럼 "시스템 식별자 (\d+)" 만 훑으면 잘린 조각이나 두 로그가 붙어버린 문자열도
 * 숫자만 걸리면 통과해버려서, 존재하지 않는 로그가 결과에 섞인다
 */
const LOG_PATTERN =
  /^\[(?<timestamp>[^\]]+)\] \[(?<level>[A-Z]+)\] 시스템 식별자 (?<id>\d+) - (?<message>.*)$/;

function parseLog(line: string): LogRecord | null {
  const groups = LOG_PATTERN.exec(line)?.groups;

  if (groups === undefined) {
    return null;
  }

  return {
    timestamp: groups.timestamp!,
    level: groups.level!,
    id: Number(groups.id),
    message: groups.message!,
  };
}

function isTarget(record: LogRecord): boolean {
  return record.level === "ERROR" && record.id % 10 === 0;
}

console.time("time");

/**
 * encoding 옵션을 주면 스트림이 알아서 문자열로 넘겨준다
 * 여기서는 디코딩을 직접 다뤄보려고 옵션을 빼고 Buffer 를 그대로 받는다
 */
const fileHandleRead = await fs.open(SOURCE_PATH, "r");
const streamRead = fileHandleRead.createReadStream({ highWaterMark: 64 * 1024 });

const fileHandleWrite = await fs.open(TARGET_PATH, "w");
const streamWrite = fileHandleWrite.createWriteStream();

/**
 * 청크 경계에서 멀티바이트 문자가 잘리는 것을 막아준다
 * 잘린 바이트는 디코더가 물고 있다가 다음 write() 결과 앞에 붙여준다
 * 이게 없으면 한글이나 이모지가 걸친 자리마다 U+FFFD 로 깨진다
 */
const decoder = new StringDecoder("utf-8");

/**
 * 구분자를 아직 만나지 못한 마지막 줄을 다음 청크까지 들고 있는 공간
 */
let leftover = "";

function handleLine(rawLine: string, matched: string[]): void {
  /**
   * CRLF 로 저장된 파일도 받아준다. 분리는 \n 으로 하고 남는 \r 만 떼어낸다
   */
  const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

  if (line === "") {
    return;
  }

  const record = parseLog(line);

  /**
   * 형식이 어긋난 줄은 여기서 탈락시킨다
   * 잘린 조각이나 두 로그가 붙어버린 문자열은 정규식을 통과하지 못한다
   */
  if (record === null) {
    return;
  }

  if (isTarget(record)) {
    matched.push(line);
  }
}

/**
 * 걸러낸 줄을 청크 단위로 모아 한번에 write() 한다
 * 줄마다 write() 를 부르면 호출 횟수만큼 오버헤드가 붙고 백프레셔 판정도 줄마다 흔들린다
 */
function flush(matched: string[]): void {
  if (matched.length === 0) {
    return;
  }

  const payload = matched.join(RECORD_SEPARATOR) + RECORD_SEPARATOR;

  if (!streamWrite.write(payload)) {
    streamRead.pause();
  }
}

streamRead.on("data", (chunk: string | Buffer) => {
  /**
   * encoding 을 주지 않았으니 항상 Buffer 로 들어온다
   * 나중에 누가 encoding 옵션을 붙이더라도 깨지지 않도록 문자열 케이스도 받아둔다
   */
  leftover += typeof chunk === "string" ? chunk : decoder.write(chunk);

  const lines = leftover.split(RECORD_SEPARATOR);

  /**
   * 마지막 요소는 구분자를 만나지 못했으므로 조건 없이 미완성으로 취급한다
   * 식별자 연속성 같은 휴리스틱으로 잘림을 "추측"하면,
   * 하필 식별자까지 온전히 남긴 채 잘렸을 때 조각을 완전한 로그로 오인한다
   */
  leftover = lines.pop() ?? "";

  if (leftover.length > MAX_LINE_LENGTH) {
    streamRead.destroy(
      new Error(`구분자 없이 ${MAX_LINE_LENGTH}바이트를 넘겼습니다. 로그 형식을 확인하세요`),
    );
    return;
  }

  const matched: string[] = [];

  for (const line of lines) {
    handleLine(line, matched);
  }

  flush(matched);
});

streamWrite.on("drain", () => {
  streamRead.resume();
});

streamRead.on("end", () => {
  /**
   * 마지막 줄은 개행 없이 끝날 수 있으니 leftover 를 여기서 처리한다
   * decoder.end() 는 디코더가 물고 있던 미완성 바이트를 마지막으로 뱉는다
   */
  const matched: string[] = [];

  handleLine(leftover + decoder.end(), matched);
  flush(matched);

  streamWrite.end();
});

streamRead.on("error", (error) => {
  console.error("읽기 실패:", error.message);
  streamWrite.destroy();
  process.exitCode = 1;
});

streamWrite.on("error", (error) => {
  console.error("쓰기 실패:", error.message);
  streamRead.destroy();
  process.exitCode = 1;
});

streamWrite.on("finish", () => {
  console.log("완료");
  console.timeEnd("time");
});
