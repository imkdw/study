"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const os_1 = require("os");
const cluster_1 = __importDefault(require("cluster"));
const events_1 = require("events");
const { pid } = process;
if (cluster_1.default.isMaster) {
    console.log("master", pid);
    const availableCpus = (0, os_1.cpus)();
    console.log("Clustering with %d CPUs", availableCpus.length);
    availableCpus.forEach(() => cluster_1.default.fork());
    process.on("SIGUSR2", () => __awaiter(void 0, void 0, void 0, function* () {
        const workers = Object.values(cluster_1.default.workers);
        for (const worker of workers) {
            console.log("Stopping Worker: %d", worker === null || worker === void 0 ? void 0 : worker.process.pid);
            worker === null || worker === void 0 ? void 0 : worker.disconnect();
            yield (0, events_1.once)(worker, "exit");
            if (!(worker === null || worker === void 0 ? void 0 : worker.exitedAfterDisconnect)) {
                continue;
            }
            const newWorker = cluster_1.default.fork();
            yield (0, events_1.once)(newWorker, "listening");
        }
    }));
}
else {
    const server = (0, http_1.createServer)((req, res) => {
        let i = 1e7;
        while (i > 0) {
            i--;
        }
        res.end(`Hello from worker ${pid}`);
    });
    server.listen(8080, () => {
        console.log(`Worker pid: ${pid}`);
    });
}
