import dgram from "dgram";

/**
 * IPv4 체계를 사용하는 독립적인 UDP 소켓 생성
 */
const udpReceiver = dgram.createSocket("udp4");

udpReceiver.on("message", (packetBuffer, senderNetworkInfo) => {
  const decodedMessage = packetBuffer.toString("utf-8");

  console.log(`[수신완료] 데이터: [${decodedMessage}]`);
  console.log(`[발송자정보] IP: [${senderNetworkInfo.address}], Port: [${senderNetworkInfo.port}]`);
});

const PORT = 7821;
const HOST = "127.0.0.1";

/**
 * OS 커널에 포트를 바인딩함
 * 시스템 콜 bind를 사용함
 */
udpReceiver.bind({ address: HOST, port: PORT });

udpReceiver.on("listening", () => {
  const currentAddr = udpReceiver.address();
  console.log(`수신중: ${currentAddr.address}:${currentAddr.port}`);
});
