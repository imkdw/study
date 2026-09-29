import net from "node:net";

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    console.log("Receieving From Client Data: ", data);
  });
});

server.listen(7777, "127.0.0.1", () => {
  console.log("Server Listening Port on: ", server.address());
});
