import fs from "node:fs";

const fileBuffer = fs.readFileSync("avatar.png");

const magicNumber = fileBuffer.toString("hex", 0, 4).toUpperCase();

console.log(`추출된 매직 넘버 : ${magicNumber}`);

if (magicNumber === "89504E47") {
  console.log(`검증 성공`);
} else {
  console.log(`검증 실패`);
}
