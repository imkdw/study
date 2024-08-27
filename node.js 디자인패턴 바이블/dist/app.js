"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.count = void 0;
exports.increment = increment;
// counter.ts
exports.count = 0;
function increment() {
    exports.count += 1;
}
// main.ts
const counter_1 = require("./counter");
console.log(exports.count); // 0
(0, counter_1.increment)();
console.log(exports.count); // 1
exports.count += 1; // TypeError: Assignment to constant variable!
