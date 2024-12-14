import Call from "./call";
import Duration from "./duration";
import Money from "./money";

export default class NightlyDiscountPhone {
  private static readonly LATE_NIGHT_HOUR = 22;

  private nightAmount: Money;
  private regularAmount: Money;
  private seconds: Duration;
  private calls: Call[] = [];

  constructor(nightAmount: Money, regularAmount: Money, seconds: Duration) {
    this.nightAmount = nightAmount;
    this.regularAmount = regularAmount;
    this.seconds = seconds;
  }

  calculateFee(): Money {
    let result = Money.ZERO;

    for (const call of this.calls) {
      if (call.getFrom().getHour() >= NightlyDiscountPhone.LATE_NIGHT_HOUR) {
        result = result.plus(this.nightAmount.times(call.getDuration().getSeconds() / this.seconds.getSeconds()));
      } else {
        result = result.plus(this.regularAmount.times(call.getDuration().getSeconds() / this.seconds.getSeconds()));
      }
    }

    return result;
  }
}
