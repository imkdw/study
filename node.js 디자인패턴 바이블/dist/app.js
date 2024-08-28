"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
function readJSON(filename, cb) {
    (0, fs_1.readFile)(filename, "utf8", (err, data) => {
        if (err) {
            return cb(err);
        }
        cb(null, JSON.parse(data)); // 에러가 발생한다면?
    });
}
readJSON("a.json", (err) => console.error(err));
