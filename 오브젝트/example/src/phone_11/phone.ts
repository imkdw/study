import Call from "./call.js";
import Money from "./money.js";
import { RatePolicy } from "./rate-policy.js";

export class Phone {
  private calls: Call[] = [];
  private ratePolicy: RatePolicy;

  constructor(ratePolicy: RatePolicy) {
    this.ratePolicy = ratePolicy;
  }

  getCalls(): Call[] {
    return this.calls;
  }

  calculateFee(): Money {
    return this.ratePolicy.calculateFee(this);
  }
}
