import http from "node:http";

const server = http.createServer((req, res) => {
  // 메인 페이지 요청 처리
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.write("ㅎㅇ");
    res.end();
  }

  // API 요청 처리
  if (req.url === "/api/courses") {
    // DB에서 가져왔다고 가정함
    const mockCourses = [1, 2, 3];

    res.writeHead(200, { "content-type": "application/json" });
    res.write(JSON.stringify(mockCourses));
    res.end();
  }
});

server.listen(9000);
console.log("서버가 9000 포트에서 대기중");
