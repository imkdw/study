"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const level_1 = require("level");
const subleveldown_1 = __importDefault(require("subleveldown"));
const db = new level_1.Level("example-db");
const salesDb = (0, subleveldown_1.default)(db, "sales", { valueEncoding: "json" });
console.log(db, salesDb);
