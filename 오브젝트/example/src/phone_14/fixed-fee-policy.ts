import { BasicRatePolicy } from "./basic-rate-policy";
import Duration from "./common/duration";
import Money from "./common/money";

export class FixedFeePolicy extends BasicRatePolicy {
  private money: Money;
  private seconds: Duration;

  constructor(money: Money, seconds: Duration) {
    super();
    this.money = money;
    this.seconds = seconds;
  }

  protected calculateCallFee(call: Call): Money {
    return this.money.times(call.getDuration().getSeconds() / this.seconds.getSeconds());
  }
}
