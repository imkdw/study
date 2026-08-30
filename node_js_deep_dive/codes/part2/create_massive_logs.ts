import fs from "node:fs/promises";
import { once } from "node:events";

const TARGET_PATH = "massive_logs.txt";

/**
 * 기본 1000만건. 가볍게 돌려보고 싶으면 TOTAL_LOGS=100000 npx tsx create_massive_logs.ts
 */
const TOTAL_LOGS = Number(process.env.TOTAL_LOGS ?? 10_000_000);

/**
 * 레코드 구분자. 공백이 아니라 개행을 쓴다
 * 공백을 구분자로 쓰면 메시지 본문에 들어간 공백과 구분이 불가능하다
 */
const RECORD_SEPARATOR = "\n";

/**
 * 배열 길이 7은 10과 서로소라서 레벨 주기와 식별자의 1의 자리가 독립적으로 돈다
 * 덕분에 "ERROR 이면서 식별자가 10의 배수" 같은 조건이 실제로 걸린다
 * (짝수=INFO, 홀수=ERROR 처럼 짜면 위 조건의 정답이 항상 0건이 되어버린다)
 */
const LEVELS = ["INFO", "WARN", "INFO", "ERROR", "INFO", "WARN", "INFO"] as const;

type LogLevel = (typeof LEVELS)[number];

/**
 * 파서를 일부러 괴롭히는 메시지들
 * - WARN  : 이중 공백이 본문에 들어있다. 공백 기준 분리가 왜 위험한지 보여준다
 * - ERROR : 4바이트 문자로 끝난다. 청크 경계에 이모지가 걸려 StringDecoder 없이는 깨진다
 */
const MESSAGES: Record<LogLevel, string> = {
  INFO: "데이터 처리 완료",
  WARN: "응답 지연  감지 (2회 연속)",
  ERROR: "네트워크 오류 발생 🔥",
};

const BASE_TIME = Date.UTC(2026, 0, 1);

/**
 * 로그 1000건이 1초씩 흐른다고 가정한다
 * toISOString() 은 비싼 편이라 초 단위로 캐싱해서 1000만번 -> 1만번으로 줄인다
 */
let cachedSecond = -1;
let cachedTimestamp = "";

function timestampOf(index: number): string {
  const second = Math.floor(index / 1000);

  if (second !== cachedSecond) {
    cachedSecond = second;
    cachedTimestamp = new Date(BASE_TIME + second * 1000).toISOString();
  }

  return cachedTimestamp;
}

/**
 * write() 를 한 줄마다 호출하면 호출 오버헤드가 그대로 비용이 된다
 * 줄을 모아 한번에 넘기면 같은 데이터를 훨씬 적은 호출로 흘려보낼 수 있다
 */
const BATCH_SIZE = 1000;

console.time("시간");

const fileHandle = await fs.open(TARGET_PATH, "w");
const stream = fileHandle.createWriteStream();

const batch: string[] = [];

for (let index = 0; index < TOTAL_LOGS; index++) {
  const level = LEVELS[index % LEVELS.length]!;

  batch.push(`[${timestampOf(index)}] [${level}] 시스템 식별자 ${index} - ${MESSAGES[level]}`);

  if (batch.length === BATCH_SIZE) {
    const payload = batch.join(RECORD_SEPARATOR) + RECORD_SEPARATOR;
    batch.length = 0;

    /**
     * write() 가 false 를 반환하면 내부 버퍼가 한계를 넘었다는 뜻이다
     * drain 을 기다리지 않고 계속 밀어넣으면 메모리에 그대로 쌓인다
     */
    if (!stream.write(payload)) {
      await once(stream, "drain");
    }
  }
}

if (batch.length > 0) {
  stream.write(batch.join(RECORD_SEPARATOR) + RECORD_SEPARATOR);
}

stream.end();

/**
 * end() 는 "더 쓸게 없다"는 신호일 뿐이고, 실제로 디스크에 다 내려간 시점은 finish 다
 * end() 직후에 시간을 재면 플러시 시간이 통째로 빠진다
 */
await once(stream, "finish");

console.timeEnd("시간");
