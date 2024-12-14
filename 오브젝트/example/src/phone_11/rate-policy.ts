import Money from "./money.js";
import { Phone } from "./phone.js";

/**
 * 기본 정책과 부가 정책을 포괄하는 인터페이스
 */
export interface RatePolicy {
  calculateFee(phone: Phone): Money;
}
