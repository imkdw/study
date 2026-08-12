import { access, open, watch, writeFile } from "node:fs/promises";

const COMMAND_FILE = "./file-commands";

/**
 * 파일 존재 여부를 확인함
 * 과거에 사용하던 fs.existsSync()와 동일한 기능을 제공함
 */
async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 명령어 해석기
 */
async function executeCommand(commandString) {
  if (typeof commandString !== "string") {
    return;
  }

  /**
   * trim의 경우 선택이 아닌 생존 스킬로 문자열을 다루는 순간 필수
   * \n, \r 등 이러한 OS에서 숨어드는 문자를 제거함
   * 제거하지 않고 그대로 문자열 일치여부 비교를 하게되면 이러한 숨어드는 문자로 인해서 예상치 못한 결과를 얻게됨
   */
  const command = commandString.trim();
  if (!command) {
    return;
  }

  if (command.startsWith("create a file ")) {
    const filePath = command.replace("create a file ", "").trim();
    await createFile(filePath);
  }
}

async function createFile(path) {
  if (typeof path !== "string") {
    return;
  }

  if (await fileExists(path)) {
    return console.log(`${path} 파일이 이미 존재합니다.`);
  }

  try {
    await writeFile(path, "");
    console.log(`${path} 파일이 생성되었습니다.`);
  } catch (error) {
    console.error(`${path} 파일 생성 실패: ${error}`);
  }
}

if (!(await fileExists(COMMAND_FILE))) {
  await writeFile(COMMAND_FILE, "");
}

console.log(`${COMMAND_FILE} 파일의 변경 사항 감시중`);

try {
  /**
   * Polling 방식으로 파일의 변경여부를 감시하면 CPU 자원을 심각하게 낭비함
   * libuv에서 OS의 Native Event를 빌려와서 커널 레벨에서 파일의 변화를 감지함
   * 이 때 변화의 시작은 하드웨어의 인터럽트 신호를 감지해서 Node로 전달함
   */
  const watcher = watch(COMMAND_FILE);

  for await (const event of watcher) {
    /**
     * 파일의 내용이 변경되는 경우
     */
    if (event.eventType === "change") {
      /**
       * readFile 대신 사용함
       * open을 사용하면 File Descriptor를 OS로 부터 받아서 갖게됨
       * 모든 컴퓨터 시스템은 파일의 데이터를 읽거나 쓰기 위해서 위 File Descriptor를 사용함
       */
      const fileHandler = await open(COMMAND_FILE, "r"); // r: 읽기 전용

      try {
        const stat = await fileHandler.stat();
        const { size } = stat;

        if (size === 0) {
          continue;
        }

        const buff = Buffer.alloc(size);
        const offset = 0;
        const length = buff.byteLength;
        const position = 0;

        await fileHandler.read(buff, offset, length, position);

        const commandString = buff.toString("utf-8");
        await executeCommand(commandString);
      } catch {
      } finally {
        /**
         * OS에서 발급할 시켜줄 수 있는 File Descriptor는 한계가 있음
         * 이 때 만약 작업이 완료되고 OS에게 반납해주지 않는다면 한계점에 도달하고 EMFILE 에러가 발생함
         * 그래서 작업이 끝나면 꼭 OS에게 File Descriptor를 반납해줘야함
         */
        await fileHandler.close();
      }
    }

    /**
     * 파일의 이름이 변경되는 경우
     */
    if (event.eventType === "rename") {
    }
  }
} catch {}
