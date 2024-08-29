"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
function helloEvents() {
    const eventEmitter = new events_1.EventEmitter();
    setTimeout(() => {
        eventEmitter.emit("complete", "event hello world"), 100;
    });
    return eventEmitter;
}
function helloCallback(cb) {
    setTimeout(() => cb(null, "callback hello world"), 100);
}
helloEvents().on("complete", (message) => console.log(message));
helloCallback((err, message) => console.log(message));
