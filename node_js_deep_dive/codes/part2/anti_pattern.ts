import { open } from "node:fs/promises";

const fileReadHandle = await open("some.txt", "r");
const streamRead = fileReadHandle.createReadStream();

streamRead.on("data", (chunk) => {
  console.log(`자동으로 가져온 데이터: ${chunk}`);
});

streamRead.on("readable", () => {
  const maunalChunk = streamRead.read();
  console.log(`수동으로 가져온 데이터: ${maunalChunk}`);
});
