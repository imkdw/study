import net from "node:net";

const socket = net.createConnection({ host: "127.0.0.1", port: 7777 }, () => {
  const buff = Buffer.from("node");

  /**
   * 4바이트(node)의 데이터를 OS의 전송계층으로 넘겨서 패킷으로 만듦
   * 이후에 목적지로 만들라고 명령함
   */
  socket.write(buff);
});
