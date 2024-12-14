import { AdditionalRatePolicy } from "./additional-rate-policy.js";
import Money from "./money.js";
import { RatePolicy } from "./rate-policy.js";

export class RateDiscountablePolicy extends AdditionalRatePolicy {
  private discountAmount: Money;

  constructor(next: RatePolicy, discountAmount: Money) {
    super(next);
    this.discountAmount = discountAmount;
  }

  protected afterCalculated(fee: Money): Money {
    return fee.minus(this.discountAmount);
  }
}
