import fs from "node:fs/promises";
import path, { join } from "node:path";
import http from "node:http";
import { pipeline } from "node:stream/promises";
import { Dongwoo, type Middleware } from "./dongwoo.ts";
import { authMiddleware, loggingMiddleware, staticMiddleware } from "./middlewares.ts";
import { bodyParser } from "./body-parser.ts";

const server = new Dongwoo();
const publicDir = path.join(process.cwd(), "public");

server.use(staticMiddleware(publicDir));
server.use(bodyParser());
server.use(loggingMiddleware);
server.use(authMiddleware);

const STATUS_CODE = {
  OK: 200,
  CREATED: 201,
  UNAUTORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

const publicPath = (fileName: string) => path.join(import.meta.dirname, "public", fileName);

server.addRoute("post", "/login", (req, res) => {
  res.status(400).json({ message: "잘못된 로그인 정보임" });
});

server.addRoute("post", "/profile-image", async (req, res) => {
  try {
    const filePath = path.join(import.meta.dirname, "storage/profile-image.jpg");
    const fileHandle = await fs.open(filePath, "w");
    await pipeline(req, fileHandle.createWriteStream());

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = STATUS_CODE.OK;

    const body = {
      message: "프로필 변경 성공",
    };

    res.end(JSON.stringify(body));
  } catch (error) {
    console.error(error);

    res.statusCode = STATUS_CODE.INTERNAL_SERVER_ERROR;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("500 Internal Server Error");
  }
});

server.addRoute("put", "/user", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = STATUS_CODE.UNAUTORIZED;

  const body = {
    error: "접근 권한 없음",
  };

  res.end(JSON.stringify(body));
});

server.listen(7821, () => console.log(`서버 7821에서 실행중`));
