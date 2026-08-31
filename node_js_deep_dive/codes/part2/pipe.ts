import { open } from "node:fs/promises";

const fileReadHandle = await open("some.txt", "r");
const streamRead = fileReadHandle.createReadStream();

const fileWriteHandle = await open("dest.txt", "w");
const streamWrite = fileWriteHandle.createWriteStream();

streamRead.pipe(streamWrite);
