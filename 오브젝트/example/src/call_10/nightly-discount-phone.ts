import Call from "./call.js";
import Money from "./money.js";
import Phone from "./phone.js";

export default class NightlyDiscountPhone extends Phone {
  private static readonly LATE_NIGHT_HOUR = 22;

  private nightlyAmount: Money;
  private regularAmount: Money;

  constructor(
    nightlyAmount: Money,
    regularAmount: Money,
    calls: Call[],
    taxRate: number
  ) {
    super(calls, taxRate);
    this.nightlyAmount = nightlyAmount;
    this.regularAmount = regularAmount;
  }

  private calculateCallFee(call: Call): Money {
    if (call.getFrom().getHour() >= NightlyDiscountPhone.LATE_NIGHT_HOUR) {
      return this.nightlyAmount.times(
        call.getDuration().getSeconds() / this.getSeconds().getSeconds()
      );
    } else {
      return this.regularAmount.times(
        call.getDuration().getSeconds() / this.getSeconds().getSeconds()
      );
    }
  }
}
