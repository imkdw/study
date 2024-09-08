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
exports.SubsetSumFork = void 0;
const events_1 = __importDefault(require("events"));
const path_1 = require("path");
const url_1 = require("url");
const process_pool_1 = require("./process-pool");
const __dirname = (0, path_1.dirname)((0, url_1.fileURLToPath)(import.meta.url));
const workerFile = (0, path_1.join)(__dirname, "subsetSumProcessWorker.js");
const workers = new process_pool_1.ProcessPool(workerFile, 2);
class SubsetSumFork extends events_1.default {
    constructor(sum, set) {
        super();
        this.sum = sum;
        this.set = set;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            const worker = yield workers.acquire();
            worker.send({ sum: this.sum, set: this.set });
            const onMessage = (msg) => {
                if (msg.event === "end") {
                    worker.removeListener("message", onMessage);
                    workers.release(worker);
                }
                this.emit(msg.event, msg.data);
            };
            worker.on("message", onMessage);
        });
    }
}
exports.SubsetSumFork = SubsetSumFork;
