import { access, open, watch, writeFile, unlink, rename, appendFile, open } from "node:fs/promises";

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

  /**
   * writeFile 메서드는 지정된 경로에 파일을 생성하지만 이미 있다면 그걸 덮어씌움
   */
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

async function deleteFile(path) {
  try {
    /**
     * 직관적으로 delete, remove 등 을 호출하지 않고 unlink를 사용함
     * inode : index node의 줄임말로 실제 파일이 하드에 몇번 주소에 있는지 등 메타데이터를 담은 주소록
     * link : inode 주소록과 파일을 연결해주는 행위
     * 즉 하나의 물리적 데이터인 inode에 여러개의 이름표르 붙여서 관리하는 방식
     *
     * unlink : 파일을 지운다는건 실제 하드에 저장된 데이터를 0으로 바꾸는게 아닌 이름표와 inode의 연결을 끊어버림
     * 연결이 끊어진건 OS에 의해서 빈 공간으로 취급되며 나중에 다른 데이터로 덮어쓸 수 있음
     */
    await unlink(path);
  } catch (e) {
    /**
     * 삭제할 파일이 이미 삭제되었거나 없다면 OS는 노드에게 ENOENT 에러를 반환함
     * 이는 Error NO ENTry라는 뜻으로 해당 항목이 없다는 뜻임
     * OS가 주소록을 뒤져봤지만 삭제할려는 파일이 없다는 뜻인데 이는 시스템 오류보단 논리적 에러에 가까움
     */
    if (e.code === "ENOENT") {
      console.log(`${path} 파일이 존재하지 않습니다.`);
    } else {
      console.error(`${path} 파일 삭제 실패: ${e.message}`);
    }
  }
}

async function renameFile(oldPath, newPath) {
  try {
    /**
     * 이름을 바꾸는거 외 newPath에 다른 경로를 지정하면 다른 폴더로 파일을 옮김
     */
    await rename(oldPath, newPath);
  } catch (e) {
    if (e.code === "ENOENT") {
      console.log(`${oldPath} 파일이 존재하지 않습니다.`);
    } else {
      console.error(`${oldPath} 파일 이름 변경 실패: ${e.message}`);
    }
  }
}

let prevContent = "";

async function appendFile(path, content) {
  /**
   * 파일을 수정한다면 임시파일, 덮어쓰기, 메타데이터 갱신 등 다양한 작업이 백그라운드에서 연쇄적으로 발생
   * 그래서 이러한 이벤트가 발생하면 노드에게 change 이벤트를 여러번 날리는 현상이 자주 발생함
   * 그래서 아래 if를 통해서 직전에 추가한 내용이랑 완전히 일치하면 중복된 값으로 인식해서 함수를 종료시킴
   */
  if (prevContent === content) {
    return;
  }

  try {
    /**
     * appendFile 메서드는 파일에 내용을 추가하는 메서드임
     * 이는 파일을 전부 메모리에 읽어들여서 마지막에 콘텐츠를 추가하고 저장하는 방식으로 동작하지 않음
     * OS 커널 레벨에서 파일의 맨 끝 포인터 위치를 찾고 해당 위치에 데이터를 쏙 추가함
     * 단 사용자가 만약 똑같은 텍스트를 여러번 입력하는 경우 막히는 문제점이 존재함
     */
    await appendFile(path, content);
    prevContent = content;
  } catch (e) {
    console.log(`${path} 파일 쓰기 실패: ${e.message}`);
  }
}

async function executeCommand(commandString) {
  if (typeof commandString !== "string") {
    return;
  }

  const command = commandString.trim();
  if (!command) {
    return;
  }

  if (command.startsWith("creeate a file")) {
    await createFile(command.replace("create a file", "").trim());
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
