import Duration from "./duration.js";
import Money from "./money.js";
import { RegularPhone } from "./regular-phone.js";

export class TaxableRegularPhone extends RegularPhone {
  private taxRate: number;

  constructor(amount: Money, seconds: Duration, taxRate: number) {
    super(amount, seconds);
    this.taxRate = taxRate;
  }

  protected afterCalculated(fee: Money): Money {
    return fee.plus(fee.times(this.taxRate));
  }
}
