import { AdditionalRatePolicy } from "./additional-rate-policy.js";
import Money from "./money.js";
import { RatePolicy } from "./rate-policy.js";

export class TaxablePolicy extends AdditionalRatePolicy {
  private taxRate: number;

  constructor(next: RatePolicy, taxRate: number) {
    super(next);
    this.taxRate = taxRate;
  }

  protected afterCalculated(fee: Money): Money {
    return fee.plus(fee.times(this.taxRate));
  }
}
