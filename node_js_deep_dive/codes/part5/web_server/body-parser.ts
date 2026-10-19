import type { Middleware } from "./dongwoo.ts";

export function bodyParser(): Middleware {
  return (req, res, next) => {
    const { method } = req;

    /**
     * HTTP GET 또는 DELETE 요청은 본문을 담아서 보내지 않음
     */
    if (method === "GET" || method === "DELETE") {
      return next();
    }

    /**
     * 요청된 데이터가 JSON이 아니라면 파싱할 데이터가 없음
     */
    if (req.headers["content-type"] !== "application/json") {
      return next();
    }

    /**
     * 데이터가 들어올 때 마다 이진 데이터를 저장해놓음
     */
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));

    /**
     * 통신이 종료되면 1회 발생하는 end 이벤트
     */
    req.on("end", () => {
      const bodyString = Buffer.concat(chunks).toString("utf-8");
      if (!bodyString) {
        req.body = {};
        return next();
      }

      try {
        req.body = JSON.parse(bodyString);
      } catch (error) {
        console.log(`[Parser Error] 본문 파싱 실패`);
        req.body = bodyString;
      }
    });

    next();
  };
}
