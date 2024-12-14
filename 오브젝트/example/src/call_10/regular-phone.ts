import Call from "./call.js";
import Duration from "./duration.js";
import Money from "./money.js";
import Phone from "./phone.js";

export default class RegularPhone extends Phone {
  private amount: Money;
  private seconds: Duration;

  constructor(
    amount: Money,
    seconds: Duration,
    calls: Call[],
    taxRate: number // 추가
  ) {
    super(calls, taxRate); // 수정
    this.amount = amount;
    this.seconds = seconds;
  }

  private calculateCallFee(call: Call): Money {
    return this.amount.times(
      call.getDuration().getSeconds() / this.seconds.getSeconds()
    );
  }
}
