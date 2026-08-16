// 챌린지 데이터: 01001110 01101111 01100100 01100101 01001010 01010011 00100001 00100001

import { Buffer } from "node:buffer";

const buff = Buffer.alloc(8);

buff[0] = 0x4e;
buff[1] = 0x6f;
buff[2] = 0x64;
buff[3] = 0x65;
buff[4] = 0x4a;
buff[5] = 0x53;
buff[6] = 0x21;
buff[7] = 0x21;

// NodeJS!!
console.log(buff.toString("utf-8"));

const smartBuff = Buffer.from([0x4e, 0x6f, 0x64, 0x65, 0x4a, 0x53, 0x21, 0x21]);
// NodeJS!!
console.log(smartBuff.toString("utf8"));
