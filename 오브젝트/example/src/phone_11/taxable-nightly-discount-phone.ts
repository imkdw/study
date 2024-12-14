import Duration from "./duration.js";
import Money from "./money.js";
import { NightlyDiscountPhone } from "./nightly-discount-phone.js";

export class TaxableNightlyDiscountPhone extends NightlyDiscountPhone {
  private taxRate: number;

  constructor(
    nightlyAmount: Money,
    regularAmount: Money,
    seconds: Duration,
    taxRate: number
  ) {
    super(nightlyAmount, regularAmount, seconds);
    this.taxRate = taxRate;
  }

  protected afterCalculated(fee: Money): Money {
    return fee.plus(fee.times(this.taxRate));
  }
}
