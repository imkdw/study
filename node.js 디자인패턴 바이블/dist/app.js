"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const http_1 = require("http");
class SubsetSum extends events_1.default {
    constructor(sum, set) {
        super();
        this.sum = sum;
        this.set = set;
        this.totalSubsets = 0;
        this.runningCombine = 0;
    }
    _combine(set, subset) {
        for (let i = 0; i < set.length; i++) {
            const newSubset = subset.concat(set[i]);
            // this._combine(set.slice(i + 1), newSubset);
            /**
             * 알고리즘의 각 단계가 setImmediate를 통해서 이벤트 루프에 대기하여
             * 실행되는 대신 보류중인 IO 요청 후 실행되도록 함
             */
            this._combineInterleaved(set.slice(i + 1), newSubset);
            this._processSubset(newSubset);
        }
    }
    _processSubset(subset) {
        console.log(subset);
        const res = subset.reduce((prev, item) => prev + item, 0);
        if (res === this.sum) {
            this.emit("match", subset);
        }
    }
    /**
     * 기존 _combine 함수를 setImmediate를 통해서 연기함
     */
    _combineInterleaved(set, subset) {
        this.runningCombine++;
        setImmediate(() => {
            this._combine(set, subset);
            if (--this.runningCombine === 0) {
                this.emit("end");
            }
        });
    }
    start() {
        this.runningCombine = 0;
        this._combineInterleaved(this.set, []);
        this.emit("end");
    }
}
(0, http_1.createServer)((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/subsetSum") {
        res.writeHead(200);
        return res.end("im alive");
    }
    const data = JSON.parse(url.searchParams.get("data"));
    const sum = parseInt(url.searchParams.get("sum"));
    res.writeHead(200);
    const subsetSum = new SubsetSum(sum, data);
    subsetSum.on("match", (match) => {
        res.write(`match: ${match}\n`);
    });
    subsetSum.on("end", () => {
        res.end();
    });
    subsetSum.start();
}).listen(8000, () => console.log("server running on 8000"));
