import { BasicRatePolicy } from "./basic-policy.js";
import Call from "./call.js";
import Duration from "./duration.js";
import Money from "./money.js";

export class NightlyDiscountPolicy extends BasicRatePolicy {
  private static readonly LATE_NIGHT_HOUR = 22;

  private nightlyAmount: Money;
  private regularAmount: Money;
  private seconds: Duration;

  constructor(nightlyAmount: Money, regularAmount: Money, seconds: Duration) {
    super();
    this.nightlyAmount = nightlyAmount;
    this.regularAmount = regularAmount;
    this.seconds = seconds;
  }

  protected calculateCallFee(call: Call): Money {
    if (call.getFrom().getHour() >= NightlyDiscountPolicy.LATE_NIGHT_HOUR) {
      return this.nightlyAmount.times(
        call.getDuration().getSeconds() / this.seconds.getSeconds()
      );
    } else {
      return this.regularAmount.times(
        call.getDuration().getSeconds() / this.seconds.getSeconds()
      );
    }
  }
}
