import fs from "node:fs";
import path from "node:path";
import type { Middleware } from "./dongwoo.ts";

export function staticMiddleware(baseDir: string): Middleware {
  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
  };

  return (req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    const requestUrl = req.url === "/" ? "/index.html" : req.url!;

    const filePath = path.join(baseDir, requestUrl);

    let extName = path.extname(filePath);
    let contentType = mimeTypes[extName];

    if (!contentType) {
      return next();
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile) {
        return next();
      }
    });

    res.sendFile(filePath, contentType);
  };
}

export const authMiddleware: Middleware = (req, res, next) => {
  console.log(`[Security] 사용자 권한 검사`);
  req.user = { id: 777, role: "admin", name: "Dongwoo" };
  next();
};

export const loggingMiddleware: Middleware = (req, res, next) => {
  console.log(`[Global Logger] ${req.method} ${req.url}에 접근함`);
  req.requestTime = new Date().toISOString();
  next();
};
