"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessPool = void 0;
const child_process_1 = require("child_process");
class ProcessPool {
    constructor(file, poolMax) {
        this.file = file;
        this.poolMax = poolMax;
        this.pool = [];
        this.active = [];
        this.waiting = [];
    }
    acquire() {
        return new Promise((resolve, reject) => {
            let worker;
            if (this.pool.length > 0) {
                worker = this.pool.pop();
                this.active.push(worker);
                return resolve(worker);
            }
            if (this.active.length >= this.poolMax) {
                return this.waiting.push({ resolve, reject });
            }
            worker = (0, child_process_1.fork)(this.file);
            worker.once("message", (message) => {
                if (message === "ready") {
                    this.active.push(worker);
                    return resolve(worker);
                }
                worker.kill();
                reject(new Error("worker process could not be initialized"));
            });
            worker.once("exit", (code) => {
                console.log(`worker exited with code ${code}`);
                this.active = this.active.filter((w) => w !== worker);
                this.pool = this.pool.filter((w) => w !== worker);
            });
            worker.once("error", (err) => {
                reject(err);
            });
        });
    }
    release(worker) {
        if (this.waiting.length > 0) {
            const { resolve } = this.waiting.shift();
            return resolve(worker);
        }
        this.active = this.active.filter((w) => w !== worker);
        this.pool.push(worker);
    }
}
exports.ProcessPool = ProcessPool;
