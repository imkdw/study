import { Buffer, constants } from "node:buffer";

const b = Buffer.alloc(1e9);

console.log(constants.MAX_LENGTH);
