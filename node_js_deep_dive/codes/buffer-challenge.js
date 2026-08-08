import { Buffer } from "node:buffer";

const incomingPacket = Buffer.from("4155544f0000018bd5506b006e00aabbccdd", "hex");

// 검증용 정답 매직 넘버
const VALID_MAGIC_NUMBER = Buffer.from("AUTO", "utf8");

console.log("--- 주행 데이터 파이프라인 가동 ---\n");

try {
  // [Task 1] 보안 검증 (Zero-copy 렌즈로 앞 4칸만 보고 비교)
  const magicNumber = incomingPacket.subarray(0, 4);
  if (!magicNumber.equals(VALID_MAGIC_NUMBER)) {
    throw new Error("매직 넘버 불일치! 우리 차량이 보낸 패킷이 아닙니다.");
  }
  console.log("[Task 1] 매직 넘버 검증 통과:", magicNumber.toString("utf8"));

  // [Task 2] 데이터 파싱 (타임스탬프는 BE, 차량 CPU 속도는 LE)
  const timestamp = incomingPacket.readBigUInt64BE(4);
  const speed = incomingPacket.readUInt16LE(12);
  console.log("[Task 2] 타임스탬프:", new Date(Number(timestamp)).toISOString());
  console.log("[Task 2] 주행 속도:", speed, "km/h");

  // [Task 3] Zero-copy 뷰 (GPS 해시 부분 14~17 인덱스)
  const gpsHash = incomingPacket.subarray(14, 18);
  console.log("[Task 3] GPS 해시 (원본 보존):", gpsHash);

  // [Task 4] 안전한 이식과 수정 (Deep Copy 후 속도 -10 수정)
  // 힌트: incomingPacket.length 크기만큼 allocUnsafe -> copy -> writeUInt16LE
  const modifiedPacket = Buffer.allocUnsafe(incomingPacket.length);
  incomingPacket.copy(modifiedPacket);
  modifiedPacket.writeUInt16LE(speed - 10, 12);
  console.log("[Task 4] 수정된 속도:", modifiedPacket.readUInt16LE(12), "km/h");
  console.log("[Task 4] 원본 속도 (불변 확인):", incomingPacket.readUInt16LE(12), "km/h");

  // [Task 5] 최종 병합 (수정한 버퍼 뒤에 <Buffer FF FF> 를 Concat)
  const footer = Buffer.from([0xff, 0xff]);
  const finalPacket = Buffer.concat([modifiedPacket, footer]);
  console.log("[Task 5] 최종 패킷:", finalPacket);
  console.log("[Task 5] 최종 길이:", finalPacket.length, "바이트");
} catch (error) {
  console.error("🚨 보안 관제 시스템 알림:", error.message);
}
