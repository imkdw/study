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
const fs_1 = require("fs");
const ini_1 = __importDefault(require("ini"));
class Config {
    constructor(formatStrategy) {
        this.data = {};
        this.formatStrategy = formatStrategy;
    }
    load(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = yield fs_1.promises.readFile(filePath, "utf-8");
            this.data = this.formatStrategy.deserialize(file);
        });
    }
    save(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.formatStrategy.serialize(this.data);
            yield fs_1.promises.writeFile(filePath, file, "utf-8");
        });
    }
}
const iniStrategy = {
    deserialize: (data) => ini_1.default.parse(data),
    serialize: (data) => ini_1.default.stringify(data),
};
const jsonStrategy = {
    deserialize: (data) => JSON.parse(data),
    serialize: (data) => JSON.stringify(data),
};
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    const jsonConfig = new Config(jsonStrategy);
    yield jsonConfig.load("static/config.json");
    yield jsonConfig.save("static/config.json");
    console.log(jsonConfig.data);
    const iniConfig = new Config(iniStrategy);
    yield iniConfig.load("static/config.ini");
    yield iniConfig.save("static/config.ini");
    console.log(iniConfig.data);
});
main();
