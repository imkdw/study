"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const http_1 = require("http");
const demultiplexChannel = (source, destinations) => {
    let currentChannel = null;
    let currentLength = null;
    source
        .on("readable", () => {
        let chunk;
        if (currentChannel === null) {
            chunk = source.read(1);
            currentChannel = chunk && chunk.readUint8(0);
        }
        if (currentLength === null) {
            chunk = source.read(4);
            currentLength = chunk && chunk.readUInt32BE(0);
            if (currentLength === null) {
                return null;
            }
        }
        chunk = source.read(currentLength);
        if (chunk === null) {
            return null;
        }
        console.log(`Received packet from child ${currentChannel}: ${chunk.toString()}`);
        destinations[currentChannel].write(chunk);
        currentChannel = null;
        currentLength = null;
    })
        .on("end", () => {
        destinations.forEach((destination) => destination.end());
        console.log("end");
    });
};
const server = (0, http_1.createServer)((socket) => {
    const stdoutStream = (0, fs_1.createWriteStream)("stdout.log");
    const stderrStream = (0, fs_1.createWriteStream)("stderr.log");
    demultiplexChannel(socket, [stdoutStream, stderrStream]);
});
server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
