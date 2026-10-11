import dgram from "dgram";

/**
 * 송신 버퍼 크기를 1MB로 지정해서 소켓을 만듦
 *
 * OS에서 기본적으로 소켓 연결을 생성할 때 마다 기본적으로 할당하는 버퍼 공간은 수 KB로 매우 작음
 * 실시간 동영상 스트리밍이나 멀티플레이어 게임 서버같은 대용량 데이터를 쏟아내면 작은 버퍼가 금방 다 차버림
 * NIC에 도달하기전에 메모리 레벨에서 금방 다 소진되어서 패킷 유실을 방지하기 위해 커널 메모리 버퍼를 확장시키는 최적화 기법임
 */
const SEND_BUFFER_SIZE = 1024 * 1024;
const udpSender = dgram.createSocket({
  type: "udp4",
  sendBufferSize: SEND_BUFFER_SIZE,
});

const payload = Buffer.from("안녕하세요, UDP의 세계에 오신 것을 환영합니다!");

const SERVER_PORT = 7821;
const SERVER_HOST = "127.0.0.1";

/**
 * TCP와 같은 handshake 과정 없이 바로 목적지를 향해서 데이터를 던짐
 * V8 엔진이 OS 레벨의 send 시스템 콜을 호출함
 *
 * 실제 패킷을 확인하면 별도의 SYN, SYN+ACK 등 과정이 전혀 없음
 */
udpSender.send(payload, SERVER_PORT, SERVER_HOST, (error, bytes) => {
  if (error) {
    console.error(`전송 실패 : ${error.message}`);
  } else {
    console.log(`${bytes} bytes 전송 완료`);
  }

  /**
   * 메모리 누수 방지를 위해서 전송 직후에 소켓을 닫고 OS에 램 자원을 반환함
   */
  udpSender.close();
});
