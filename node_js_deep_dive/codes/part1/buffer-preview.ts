import fs from "node:fs";

// 1. 넷플릭스 클라이언트(브라우저)가 영상 중간으로 스킵을 눌러 Range 헤더를 보냈음
const rangeHeader = "bytes=1048576-2097151"; // "1MB 지점부터 2MB 지점까지만 줘!"

// 2. 정규식으로 필요한 바이트의 시작(Start)과 끝(End) 지점을 파싱함
const [start, end] = rangeHeader
  .replace(/bytes=/, "")
  .split("-")
  .map(Number);

// 3. 파일 시스템 스트림에게 지시: "파일 다 읽지 말고, 딱 저 물리적 바이트 위치만 읽어서 버퍼로 퍼올려!"
const videoStream = fs.createReadStream("movie.mp4", { start, end });

console.log(`클라이언트에게 ${start} 바이트부터 ${end} 바이트까지만 잘라서 206 상태코드로 스트리밍함`);
// 실무에서는 이 videoStream을 HTTP Response 객체로 파이프(pipe) 연결하여 쏨
