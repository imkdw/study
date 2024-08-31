"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
function promisify(callbackBasedApi) {
    return function promisified(...args) {
        // 새로운 Promise를 생성하고 반환함
        return new Promise((resolve, reject) => {
            // 콜백함수를 인자로 넘길때는 제일 마지막에 넘김
            // 해당 특성을 이용해서 resolve, reject를 처리
            const newArgs = [
                ...args,
                (err, result) => {
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
const randomBytesPromisified = promisify(crypto_1.randomBytes);
randomBytesPromisified(10).then((bytes) => {
    console.log(bytes);
});
function main() {
    const randomBytesPromise = (0, crypto_1.randomBytes)(10);
    console.log(randomBytesPromise);
}
main();
