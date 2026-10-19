import net from "node:net";

const server = net.createServer((socket) => {
  socket.on("data", (chunk) => {
    console.log(chunk.toString("utf-8"));
  });
});

server.listen(7821, () => console.log("서버 7821에서 동작중"));
