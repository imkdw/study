import Call from "./call.js";
import Money from "./money.js";
import { Phone } from "./phone.js";
import { RatePolicy } from "./rate-policy.js";

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
