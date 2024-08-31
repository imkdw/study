import { randomBytes } from "crypto";

function promisify(callbackBasedApi: any) {
  return function promisified(...args: any[]) {
    // 새로운 Promise를 생성하고 반환함
    return new Promise((resolve, reject) => {
      // 콜백함수를 인자로 넘길때는 제일 마지막에 넘김
      // 해당 특성을 이용해서 resolve, reject를 처리
      const newArgs = [
        ...args,
        (err: unknown, result: any) => {
          if (err) {
            return reject(err);
          }

          resolve(result);
        },
      ];

      callbackBasedApi(...newArgs);
    });
  };
}

const randomBytesPromisified = promisify(randomBytes);

randomBytesPromisified(10).then((bytes) => {
  console.log(bytes);
});

function main() {
  const randomBytesPromise = randomBytes(10);
  console.log(randomBytesPromise);
}

main();
