import Duration from "./duration.js";
import Money from "./money.js";
import { RegularPhone } from "./regular-phone.js";

export class RateDiscountableRegularPhone extends RegularPhone {
  private discountAmount: Money;

  constructor(amount: Money, seconds: Duration, discountAmount: Money) {
    super(amount, seconds);
    this.discountAmount = discountAmount;
  }

  protected afterCalculated(fee: Money): Money {
    return fee.minus(this.discountAmount);
  }
}
