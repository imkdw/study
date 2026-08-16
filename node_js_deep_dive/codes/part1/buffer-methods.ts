const chunk1 = Buffer.from("Node.js는 ");
const chunk2 = Buffer.from("정말 ");
const chunk3 = Buffer.from("강력합니다!");

const finalBuffer = Buffer.concat([chunk1, chunk2, chunk3]);

// 병합 결과: Node.js는 정말 강력합니다!
console.log("병합 결과:", finalBuffer.toString("utf-8"));
