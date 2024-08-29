"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
let count = 0;
const tick = (emitter, ms) => {
    if (ms % 5 === 0) {
        throw new Error("ms must be a multiple of 5");
    }
    count++;
    emitter.emit("tick");
};
const ticker = (ms, cb) => {
    const eventEmitter = new events_1.default();
    try {
        tick(eventEmitter, ms);
        const interval = setInterval(() => tick(eventEmitter, ms), 50);
        setTimeout(() => {
            clearInterval(interval);
            cb(count);
        }, ms);
    }
    catch (err) {
        eventEmitter.emit("error", err);
    }
    return eventEmitter;
};
const emitter = ticker(500, (count) => {
    console.log(count);
})
    .on("tick", () => { })
    .on("error", (err) => {
    console.error(err);
});
