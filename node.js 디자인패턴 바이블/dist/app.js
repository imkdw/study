"use strict";
class Queue {
    constructor() {
        this.queue = [];
    }
    dequeue() {
        return new Promise((res) => {
            res(this.queue);
        });
    }
}
