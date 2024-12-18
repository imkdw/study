import Money from "./common/money";
import { RatePolicy } from "./rate-policy";

export abstract class BasicRatePolicy implements RatePolicy {
  calculateFee(phone: Phone): Money {
    let result = Money.ZERO;

    for (const call of phone.getCalls()) {
      result = result.plus(this.calculateCallFee(call));
    }

    return result;
  }

  protected abstract calculateCallFee(call: Call): Money;
}
