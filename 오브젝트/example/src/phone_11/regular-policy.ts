import { BasicRatePolicy } from "./basic-policy.js";
import Call from "./call.js";
import Duration from "./duration.js";
import Money from "./money.js";

/**
 * 일반 요금제
 */
export class RegularPolicy extends BasicRatePolicy {
  private amount: Money;
  private seconds: Duration;

  constructor(amount: Money, seconds: Duration) {
    super();
    this.amount = amount;
    this.seconds = seconds;
  }

  protected calculateCallFee(call: Call): Money {
    return this.amount.times(
      call.getDuration().getSeconds() / this.seconds.getSeconds()
    );
  }
}
