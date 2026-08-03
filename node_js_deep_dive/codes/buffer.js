import { Buffer } from "node:buffer";

const memContainer = Buffer.alloc(4);

// 0번째 칸에 나이 25 저장
memContainer.writeInt8(25, 0);

// 2번째 칸에 점수 100 저장
memContainer.writeInt8(100, 2);

console.log(memContainer.readInt8(0)); // 25
console.log(memContainer.readInt8(2)); // 100
