const delay = <T>(time: number, value: T): Promise<T> => new Promise((resolve) => setTimeout(resolve, time, value));

type MyFile = {
  name: string;
  body: string;
  size: number;
};

async function getFile(name: string, size = 1000): Promise<MyFile> {
  return delay<MyFile>(size, { name, body: "...", size });
}

const settlePromise = <T>(promise: Promise<T>) =>
  promise.then((value) => ({ status: "fulfilled", value })).catch((reason) => ({ status: "rejected", reason }));

async function init() {
  console.time("init");

  const files = await Promise.any([
    getFile("file3", 700),
    delay(500, "dummy").then(() => Promise.reject("다운로드 실패")),
    delay(500, "dummy").then(() => Promise.reject("다운로드 실패")),
  ]);

  // node:internal/process/promises:394
  //  triggerUncaughtException(err, true /* fromPromise */);
  //  ^

  // [AggregateError: All promises were rejected] {
  //   [errors]: [ '다운로드 실패', '다운로드 실패' ]
  // }
  console.log(files);

  console.timeEnd("init");
}

init();
