import Money from "./common/money";

export interface RatePolicy {
  calculateFee(phone: Phone): Money;
}
