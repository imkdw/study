import { fork } from "child_process";
import { connect } from "net";
import { Readable, Writable } from "stream";

/**
 * 채널 다중화 처리
 * 1. readable 이벤트에 대한 리스너를 등록, non-flowing 모드 사용
 * 2. 청크를 읽어서 채널ID, 패킷의 크기, 실제 데이터를 순서대로 포함하고 패킷으로 묶음
 * 3. 패킷이 준비되면 목적지 스트림에 기록
 * 4. 모든 소스 스트림이 종료되면 목적지 스트림을 종료할 수 있도록 end 이벤트 리스너 등록
 */
const multiplexChannels = (sources: Readable[], destination: Writable) => {
  let openChannels = sources.length;

  for (let i = 0; i < sources.length; i++) {
    sources[i]
      .on("readable", function () {
        let chunk: Buffer;

        while ((chunk = sources[i].read()) !== null) {
          const outBuff = Buffer.alloc(1 + 4 + chunk.length);
          outBuff.writeUint8(i, 0);
          outBuff.writeUInt32BE(chunk.length, 1);
          chunk.copy(outBuff, 5);
          console.log(`Send packet ${i} with ${chunk.length} bytes`);
          destination.write(outBuff);
        }
      })
      .on("end", () => {
        if (--openChannels === 0) {
          destination.end();
        }
      });
  }
};

/**
 * 1. localhost:3000 서버에 대한 TCP 연결 생성
 * 2. 인자를 통해서 자식 프로세스를 실행, slient: false를 통해서 부모 프로세스 상속 방지
 * 3. 자식 프로세스의 stdout, stderr을 가져와서 Wrtiable Stream으로 멀티플렉싱
 */
const socket = connect(3000, "localhost", () => {
  const child = fork(process.argv[2], process.argv.slice(3), { silent: true });
  multiplexChannels([child.stdout!, child.stderr!], socket);
});
