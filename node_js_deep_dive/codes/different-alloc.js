import { Buffer } from "node:buffer";

/**
 * 2KB의 공간을 할당함
 * 기본값은 항상 0으로 채워지는데 메모리는 누구나 번갈아가며 사용하는 화이트보드와 같음
 * OS로 부터 새로운 새로운 메모리를 할당받을때 모두 0으로 채워짐
 * 성능 관점에서 보면 빈 공간에 0을 2048개를 채우는건 CPU에게 무거운 작업임
 */
const buffer = Buffer.alloc(2048);

/**
 * OS에서 메모리를 할당받자마자 빈 공간을 0이 아닌 원래 존재하던 값을 그대로 이어받음
 * 해당 메모리 공간은 방금까지 컴퓨터의 다른 프로그램이 사용하던 정보가 그대로 남아있음
 * 단순한 찌꺼기라면 다행이지만 상주하던 정보가 남아있다면 큰 문제가 될 수 있음
 * 성능은 alloc 보다 좋은데 이는 0으로 fill 하는 과정이 없기 떄문임
 * 이러한 메모리에 남아있던 정보를 가져오는 취약점을 Memory Disclosure 라고 부름
 */
const BUFFER_SIZE = 10240;
const unsafeBuffer = Buffer.allocUnsafe(BUFFER_SIZE);

let foundCount = 0;
for (let i = 0; i < BUFFER_SIZE; i++) {
  if (unsafeBuffer[i] !== 0) {
    const byte = unsafeBuffer[i];
    const binary = byte.toString(2).padStart(8, "0");
    const hex = byte.toString(16).toUpperCase().padStart(2, "0");
    const char = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : "?";

    // [Index 16] Hex: 0x58 | Bin: 01011000
    // [Index 17] Hex: 0xA0 | Bin: 10100000
    // [Index 18] Hex: 0x15 | Bin: 00010101
    // [Index 19] Hex: 0xB7 | Bin: 10110111
    // [Index 20] Hex: 0x09 | Bin: 00001001
    console.log(`[Index ${i.toString().padStart(5, "")}] Hex: 0x${hex} | Bin: ${binary}`);

    foundCount++;
  }
}

// 8192
console.log(Buffer.poolSize);

// 4096
// 비트 시프트 연산자로 이진수 데이터 전체를 오른쪽으로 한칸 밀어냄
// 가장 오른쪽을 허공에 그냥 버림, 즉 111100 -> 011110 이런식으로 바뀜
// 숫자를 2로 나누고 나머지를 버리는 연산과 동일함. 추가로 사칙연산보다 비트 연산이 훨씬 빠름
console.log(Buffer.poolSize >>> 1);
