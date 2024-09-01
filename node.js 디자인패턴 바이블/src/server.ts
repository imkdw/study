import { createWriteStream } from "fs";
import { createServer } from "http";
import { Readable, Writable } from "stream";

const demultiplexChannel = (source: Readable, destinations: Writable[]) => {
  let currentChannel: any = null;
  let currentLength: any = null;

  source
    .on("readable", () => {
      let chunk: Buffer;

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

      console.log(
        `Received packet from child ${currentChannel}: ${chunk.toString()}`
      );
      destinations[currentChannel].write(chunk);

      currentChannel = null;
      currentLength = null;
    })
    .on("end", () => {
      destinations.forEach((destination) => destination.end());
      console.log("end");
    });
};

const server = createServer((socket) => {
  const stdoutStream = createWriteStream("stdout.log");
  const stderrStream = createWriteStream("stderr.log");
  demultiplexChannel(socket, [stdoutStream, stderrStream]);
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
