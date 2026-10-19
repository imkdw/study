import http from "node:http";
import fs from "node:fs/promises";

declare module "node:http" {
  interface IncomingMessage {
    requestTime?: string;
    user?: {
      id: number;
      role: string;
      name: string;
    };
    body: unknown;
  }

  interface ServerResponse {
    sendFile(filePath: string, mimeType: string): Promise<void>;
    status(code: number): this;
    json(data: unknown): void;
  }
}

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;
export type Middleware = (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;

export class Dongwoo {
  private readonly server: http.Server;
  private routingTable: Record<string, Handler> = {};
  private readonly middlewares: Middleware[] = [];

  constructor() {
    this.server = http.createServer();
    this.server.on("request", (req, res) => {
      res.sendFile = async (filePath, mimeType) => {
        const fileHandle = await fs.open(filePath, "r");
        const fileStream = fileHandle.createReadStream();

        res.setHeader("Content-Type", mimeType);
        fileStream.pipe(res);
      };

      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };

      res.json = (data: unknown) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(data));
      };

      let idx = 0;

      const next = () => {
        if (idx < this.middlewares.length) {
          const currentMiddleware = this.middlewares[idx++];
          currentMiddleware(req, res, next);
        } else {
          const routeKey = req.method!.toLowerCase() + req.url;
          const executeHandler = this.routingTable[routeKey];

          if (!executeHandler) {
            console.log(`[경고] 미등록 라우트 호출 감지 : [${req.method}] ${req.url}`);
            return res.status(404).json({ error: `[${req.method}] ${req.url} 경로가 없습니다` });
          }

          executeHandler(req, res);
        }
      };

      next();
    });
  }

  use(middleware: Middleware) {
    this.middlewares.push(middleware);
  }

  addRoute(method: string, path: string, handler: Handler) {
    const key = method.toLowerCase() + path;
    this.routingTable[key] = handler;
  }

  listen(port: number, callback: () => void) {
    this.server.listen(port, () => callback());
  }
}
