import http from "node:http";

const server = http.createServer();

const PORT = 7821;

server.listen(PORT, () => console.log(`${PORT}에서 서버 열림`));

function parseStringHeader(req: http.IncomingMessage, property: string) {
  const raw = req.headers[property];
  if (typeof raw !== "string") {
    return "";
  }

  return raw;
}

server.on("request", (req, res) => {
  console.log("--- 헤더에서 추출한 커스텀 정보 ---");

  const authorName = decodeURIComponent(parseStringHeader(req, "name"));
  console.log(`작성자: ${authorName}`);

  /**
   * 쪼개서 들어오는 이진 버퍼 조각들 담을 임시 배열
   */
  const chunks: Buffer[] = [];

  /**
   * TCP 단편화 문제를 대비해서 들어온 데이터를 모두 이진 버퍼로 저장해놓음
   */
  req.on("data", (chunk: Buffer) => chunks.push(chunk));

  req.on("end", () => {
    const rawData = Buffer.concat(chunks).toString("utf-8");
    const parsedData = JSON.parse(rawData);

    res.writeHead(200, { "content-type": "application/json" });

    res.end(
      JSON.stringify({
        message: `제목이 '${parsedData.title}'인 포스트가 '${authorName}'님에 의해서 작성됨`,
      }),
    );
  });
});
