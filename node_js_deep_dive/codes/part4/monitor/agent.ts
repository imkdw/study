/**
 * 계측 대상 프로세스에 주입하는 프리로드 모듈
 *
 *   node --import ./monitor/agent.ts upload_server.ts
 *
 * 대상 코드를 고치지 않고 메모리 / CPU / 이벤트 루프 지연 / GC / 스트림 버퍼를 주기적으로 재서 수집기로 보냄
 * 타이머와 소켓은 전부 unref 해서 대상 프로세스의 종료 시점에 영향을 주지 않음
 */
import net from "node:net";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import diagnosticsChannel from "node:diagnostics_channel";
import { syncBuiltinESMExports } from "node:module";
import { constants, monitorEventLoopDelay, performance, PerformanceObserver } from "node:perf_hooks";
import type { Readable, Writable } from "node:stream";

const COLLECTOR_HOST = "127.0.0.1";
const COLLECTOR_PORT = Number(process.env.MONITOR_PORT ?? 7071);
const SAMPLE_INTERVAL_MS = Number(process.env.MONITOR_INTERVAL ?? 20);
const EVENT_LOOP_RESOLUTION_MS = 10;
const RECONNECT_DELAY_MS = 1000;
const MAX_PENDING_BYTES = 1024 * 1024;

type GcEvent = { t: number; d: number; k: "minor" | "major" };

/**
 * 스트림 버퍼 추적
 * 살아있는 스트림은 Set 에 들고 있다가 샘플링 때 버퍼 길이를 합산하고, 닫히면 누적 바이트만 남기고 버림
 */
const liveSockets = new Set<net.Socket>();
const liveFileReads = new Set<fs.ReadStream>();
const liveFileWrites = new Set<fs.WriteStream>();
const closedBytes = { netIn: 0, netOut: 0, diskRead: 0, diskWrite: 0 };

let creatingOwnSocket = false;

function trackSocket(socket: net.Socket) {
  if (creatingOwnSocket || liveSockets.has(socket)) return;
  liveSockets.add(socket);
  socket.once("close", () => {
    liveSockets.delete(socket);
    closedBytes.netIn += socket.bytesRead;
    closedBytes.netOut += socket.bytesWritten;
  });
}

function trackFileRead(stream: fs.ReadStream) {
  liveFileReads.add(stream);
  stream.once("close", () => {
    liveFileReads.delete(stream);
    closedBytes.diskRead += stream.bytesRead;
  });
  return stream;
}

function trackFileWrite(stream: fs.WriteStream) {
  liveFileWrites.add(stream);
  stream.once("close", () => {
    liveFileWrites.delete(stream);
    closedBytes.diskWrite += stream.bytesWritten;
  });
  return stream;
}

/**
 * 소켓은 Node.js 가 직접 알려주는 진단 채널을 구독해서 잡음 (클라 소켓 / 서버가 accept 한 소켓)
 */
diagnosticsChannel.subscribe("net.client.socket", (message) => {
  trackSocket((message as { socket: net.Socket }).socket);
});
diagnosticsChannel.subscribe("net.server.socket", (message) => {
  trackSocket((message as { socket: net.Socket }).socket);
});

/**
 * 파일 스트림은 알려주는 채널이 없어서 생성 함수를 감싸서 잡음
 * fs.createReadStream / fs.createWriteStream 과 FileHandle 의 같은 이름 메서드가 대상
 */
const originalCreateReadStream = fs.createReadStream;
const originalCreateWriteStream = fs.createWriteStream;
fs.createReadStream = function (...args: Parameters<typeof fs.createReadStream>) {
  return trackFileRead(originalCreateReadStream.apply(fs, args));
} as typeof fs.createReadStream;
fs.createWriteStream = function (...args: Parameters<typeof fs.createWriteStream>) {
  return trackFileWrite(originalCreateWriteStream.apply(fs, args));
} as typeof fs.createWriteStream;
syncBuiltinESMExports();

/**
 * FileHandle 클래스는 외부로 노출되지 않아서 파일을 하나 열어 프로토타입을 얻어냄
 */
const probeHandle = await fsp.open(process.execPath, "r");
const fileHandlePrototype = Object.getPrototypeOf(probeHandle) as fsp.FileHandle;
await probeHandle.close();

const originalHandleReadStream = fileHandlePrototype.createReadStream;
const originalHandleWriteStream = fileHandlePrototype.createWriteStream;
fileHandlePrototype.createReadStream = function (this: fsp.FileHandle, ...args) {
  return trackFileRead(originalHandleReadStream.apply(this, args));
};
fileHandlePrototype.createWriteStream = function (this: fsp.FileHandle, ...args) {
  return trackFileWrite(originalHandleWriteStream.apply(this, args));
};

function sumReadable(streams: Iterable<Readable>) {
  let total = 0;
  for (const stream of streams) total += stream.readableLength;
  return total;
}

function sumWritable(streams: Iterable<Writable>) {
  let total = 0;
  for (const stream of streams) total += stream.writableLength;
  return total;
}

/**
 * GC 는 발생할 때마다 모아뒀다가 다음 샘플에 실어 보냄
 */
let pendingGcEvents: GcEvent[] = [];
const gcObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const kind = (entry as unknown as { detail: { kind: number } }).detail.kind;
    const isMajor = kind === constants.NODE_PERFORMANCE_GC_MAJOR || kind === constants.NODE_PERFORMANCE_GC_INCREMENTAL;
    pendingGcEvents.push({
      t: performance.timeOrigin + entry.startTime,
      d: entry.duration,
      k: isMajor ? "major" : "minor",
    });
  }
});
gcObserver.observe({ entryTypes: ["gc"] });

const eventLoopDelay = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
eventLoopDelay.enable();

/**
 * 수집기 연결
 * 수집기가 꺼져 있어도 대상 프로세스는 그대로 돌아야 하므로 실패는 조용히 넘기고 주기적으로 재시도함
 */
let collectorSocket: net.Socket | null = null;

function connectToCollector() {
  creatingOwnSocket = true;
  const socket = net.createConnection({ host: COLLECTOR_HOST, port: COLLECTOR_PORT });
  creatingOwnSocket = false;
  socket.unref();

  socket.on("connect", () => {
    collectorSocket = socket;
    send({
      type: "hello",
      pid: process.pid,
      name: path.basename(process.argv[1] ?? "node"),
      node: process.version,
      interval: SAMPLE_INTERVAL_MS,
      startedAt: performance.timeOrigin,
    });
  });
  socket.on("error", () => {});
  socket.on("close", () => {
    collectorSocket = null;
    setTimeout(connectToCollector, RECONNECT_DELAY_MS).unref();
  });
}

function send(message: object) {
  if (!collectorSocket || collectorSocket.writableLength > MAX_PENDING_BYTES) return;
  collectorSocket.write(JSON.stringify(message) + "\n");
}

let lastCpuUsage = process.cpuUsage();
let lastSampledAt = performance.now();

function sample() {
  const now = performance.now();
  const elapsedMicros = (now - lastSampledAt) * 1000;
  const cpuUsage = process.cpuUsage();
  const memory = process.memoryUsage();

  let netIn = closedBytes.netIn;
  let netOut = closedBytes.netOut;
  for (const socket of liveSockets) {
    netIn += socket.bytesRead;
    netOut += socket.bytesWritten;
  }
  let diskRead = closedBytes.diskRead;
  for (const stream of liveFileReads) diskRead += stream.bytesRead;
  let diskWrite = closedBytes.diskWrite;
  for (const stream of liveFileWrites) diskWrite += stream.bytesWritten;

  /**
   * 히스토그램은 타이머 간격 자체를 기록하므로 설정한 해상도만큼 빼야 순수 지연이 됨
   */
  const hasLoopSamples = eventLoopDelay.count > 0;
  const loopMean = hasLoopSamples ? Math.max(0, eventLoopDelay.mean / 1e6 - EVENT_LOOP_RESOLUTION_MS) : 0;
  const loopMax = hasLoopSamples ? Math.max(0, eventLoopDelay.max / 1e6 - EVENT_LOOP_RESOLUTION_MS) : 0;
  eventLoopDelay.reset();

  send({
    type: "sample",
    t: Date.now(),
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
    cpuUser: ((cpuUsage.user - lastCpuUsage.user) / elapsedMicros) * 100,
    cpuSystem: ((cpuUsage.system - lastCpuUsage.system) / elapsedMicros) * 100,
    loopMean,
    loopMax,
    sockWritable: sumWritable(liveSockets),
    sockReadable: sumReadable(liveSockets),
    fileWritable: sumWritable(liveFileWrites),
    fileReadable: sumReadable(liveFileReads),
    netIn,
    netOut,
    diskRead,
    diskWrite,
    gc: pendingGcEvents,
  });

  pendingGcEvents = [];
  lastCpuUsage = cpuUsage;
  lastSampledAt = now;
}

connectToCollector();
setInterval(sample, SAMPLE_INTERVAL_MS).unref();

/**
 * 대상 프로세스가 할 일을 다 끝내고 종료하려는 순간 마지막 샘플을 한 번 더 보냄
 * 소켓이 unref 상태라 그냥 두면 전송 전에 프로세스가 죽으므로 다 보낼 때까지만 잠깐 붙잡아 둠
 */
let flushedOnExit = false;
process.on("beforeExit", () => {
  if (flushedOnExit || !collectorSocket) return;
  flushedOnExit = true;
  sample();
  const socket = collectorSocket;
  socket.ref();
  socket.write("", () => socket.unref());
});
