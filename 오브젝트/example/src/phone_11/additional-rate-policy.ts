import Money from "./money.js";
import { Phone } from "./phone.js";
import { RatePolicy } from "./rate-policy.js";

export abstract class AdditionalRatePolicy implements RatePolicy {
  private next: RatePolicy;

  constructor(next: RatePolicy) {
    this.next = next;
  }

  calculateFee(phone: Phone): Money {
    const fee = this.next.calculateFee(phone);
    return this.afterCalculated(fee);
  }

  protected abstract afterCalculated(fee: Money): Money;
}
