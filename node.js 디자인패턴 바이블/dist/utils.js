"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlToFilename = urlToFilename;
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const slug_1 = __importDefault(require("slug"));
function urlToFilename(url) {
    const parsedUrl = new url_1.URL(url);
    const urlPath = parsedUrl.pathname
        .split("/")
        .filter(function (component) {
        return component !== "";
    })
        .map(function (component) {
        return (0, slug_1.default)(component, { remove: null });
    })
        .join("/");
    let filename = path_1.default.join(parsedUrl.hostname, urlPath);
    if (!path_1.default.extname(filename).match(/htm/)) {
        filename += ".html";
    }
    return filename;
}
