import Call from "./call.js";
import Duration from "./duration.js";
import Money from "./money.js";
import { Phone } from "./phone.js";

export class NightlyDiscountPhone extends Phone {
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

  calculateCallFee(call: Call): Money {
    if (call.getFrom().getHour() >= NightlyDiscountPhone.LATE_NIGHT_HOUR) {
      return this.nightlyAmount.times(
        call.getDuration().getSeconds() / this.seconds.getSeconds()
      );
    } else {
      return this.regularAmount.times(
        call.getDuration().getSeconds() / this.seconds.getSeconds()
      );
    }
  }

  // 심야 요금제는 요금을 수정할 필요가 없어서 요금 그대로 반환
  protected afterCalculated(fee: Money): Money {
    return fee;
  }
}
