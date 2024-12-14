import Duration from "./duration.js";
import Money from "./money.js";
import { NightlyDiscountPhone } from "./nightly-discount-phone.js";

export class RateDiscountableNightlyDiscountPhone extends NightlyDiscountPhone {
  private discountAMount: Money;

  constructor(
    nightlyAmount: Money,
    regularAmount: Money,
    seconds: Duration,
    discountAmount: Money
  ) {
    super(nightlyAmount, regularAmount, seconds);
    this.discountAMount = discountAmount;
  }

  protected afterCalculated(fee: Money): Money {
    return fee.minus(this.discountAMount);
  }
}
