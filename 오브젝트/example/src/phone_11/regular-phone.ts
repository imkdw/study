import Call from "./call.js";
import Duration from "./duration.js";
import Money from "./money.js";
import { Phone } from "./phone.js";

export class RegularPhone extends Phone {
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

  // 일반 요금제를 요금을 수정할 필요가 없어서 요금 그대로 반환
  protected afterCalculated(fee: Money): Money {
    return fee;
  }
}
