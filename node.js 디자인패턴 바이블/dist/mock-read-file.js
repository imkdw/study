"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockEnable = mockEnable;
exports.mockDisable = mockDisable;
const fs_1 = __importDefault(require("fs"));
const originalReadFile = fs_1.default.readFile;
let mockedResponse = null;
function mockedReadFile(path, cb) {
    setImmediate(() => {
        cb(null, mockedResponse);
    });
}
function mockEnable(respondWith) {
    mockedResponse = respondWith;
    fs_1.default.readFile = mockedReadFile;
}
function mockDisable() {
    fs_1.default.readFile = originalReadFile;
}
