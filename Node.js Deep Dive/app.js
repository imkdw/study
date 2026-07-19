const password = "외부 유출 금지";

/**
 * Named Export 방식
 * 여러 개의 기능을 각각 내보낼 때 사용
 */
export function printMesage(message) {
  console.log(`[System] ${message}`);
}
export const version = "1.0.0";

/**
 * Default Export 방식
 * 이 파일의 가장 대표적인 기능 하나만 딱 내보낼 떄 사용
 */
export default function initializeLogger() {
  console.log("Logger System Initialized");
}
