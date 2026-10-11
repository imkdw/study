/**
 * 수집기 겸 대시보드 서버
 *
 *   node monitor/collector.ts
 *
 * agent.ts 가 보내는 샘플을 TCP 로 받아서 브라우저에 SSE 로 실시간 전달함
 * 저장은 하지 않고, 새로고침해도 그래프가 이어지도록 메모리에만 잠깐 들고 있음
 */
import net from "node:net";
import http from "node:http";
import fs from "node:fs/promises";

const HOST = "127.0.0.1";
const INGEST_PORT = Number(process.env.MONITOR_PORT ?? 7071);
const DASHBOARD_PORT = Number(process.env.MONITOR_DASHBOARD_PORT ?? 7070);
const MAX_SAMPLES_PER_PROCESS = 30_000;
const DASHBOARD_FILE = new URL("./dashboard.html", import.meta.url);

type TrackedProcess = {
  id: string;
  pid: number;
  name: string;
  node: string;
  interval: number;
  startedAt: number;
  ended: boolean;
  samples: object[];
};

const processes = new Map<string, TrackedProcess>();
const browsers = new Set<http.ServerResponse>();

function broadcast(event: string, data: object) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const browser of browsers) browser.write(payload);
}

const ingestServer = net.createServer((agentSocket) => {
  let tracked: TrackedProcess | null = null;
  let buffered = "";

  agentSocket.setEncoding("utf8");
  agentSocket.on("data", (chunk: string) => {
    buffered += chunk;

    let newlineIndex: number;
    while ((newlineIndex = buffered.indexOf("\n")) !== -1) {
      const message = JSON.parse(buffered.slice(0, newlineIndex));
      buffered = buffered.slice(newlineIndex + 1);

      if (message.type === "hello") {
        /**
         * 같은 스크립트를 다시 돌리면 끝난 이전 실행은 화면에서 치움
         */
        for (const [id, existing] of processes) {
          if (existing.ended && existing.name === message.name) {
            processes.delete(id);
            broadcast("remove", { id });
          }
        }

        const { type: _type, ...info } = message;
        tracked = { ...info, id: `${message.pid}-${Date.now()}`, ended: false, samples: [] };
        processes.set(tracked!.id, tracked!);
        const { samples: _samples, ...summary } = tracked!;
        broadcast("process", summary);
        console.log(`계측 시작 : ${tracked!.name} (pid ${tracked!.pid})`);
      } else if (message.type === "sample" && tracked) {
        const { type: _type, ...sample } = message;
        tracked.samples.push(sample);
        if (tracked.samples.length > MAX_SAMPLES_PER_PROCESS) tracked.samples.shift();
        broadcast("sample", { id: tracked.id, sample });
      }
    }
  });

  agentSocket.on("error", () => {});
  agentSocket.on("close", () => {
    if (!tracked) return;
    tracked.ended = true;
    broadcast("end", { id: tracked.id });
    console.log(`계측 종료 : ${tracked.name} (pid ${tracked.pid})`);
  });
});

const dashboardServer = http.createServer(async (request, response) => {
  if (request.url === "/events") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    response.write(`event: init\ndata: ${JSON.stringify([...processes.values()])}\n\n`);
    browsers.add(response);
    request.on("close", () => browsers.delete(response));
    return;
  }

  if (request.url === "/clear" && request.method === "POST") {
    for (const [id, tracked] of processes) {
      if (tracked.ended) {
        processes.delete(id);
        broadcast("remove", { id });
      }
    }
    response.writeHead(204).end();
    return;
  }

  if (request.url === "/") {
    /**
     * 대시보드를 고치면서 볼 수 있게 요청마다 파일을 새로 읽음
     */
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(await fs.readFile(DASHBOARD_FILE));
    return;
  }

  response.writeHead(404).end();
});

ingestServer.listen(INGEST_PORT, HOST);
dashboardServer.listen(DASHBOARD_PORT, HOST, () => {
  console.log(`대시보드 : http://${HOST}:${DASHBOARD_PORT}`);
  console.log(`계측 대상 실행 : node --import ./monitor/agent.ts <스크립트>`);
});
