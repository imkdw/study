import Call from "./call";
import Duration from "./duration";
import Money from "./money";

export default class Phone {
  private amount: Money;
  private seconds: Duration;
  private calls: Call[] = [];
  private taxRate: number;

  constructor(amount: Money, seconds: Duration, taxRate: number) {
    this.amount = amount;
    this.seconds = seconds;
    this.taxRate = taxRate;
  }

  call(call: Call) {
    this.calls.push(call);
  }

  getCalls(): Call[] {
    return this.calls;
  }

  getAmount(): Money {
    return this.amount;
  }

  getSeconds(): Duration {
    return this.seconds;
  }

  calculateFee(): Money {
    let result = Money.ZERO;

    for (const call of this.calls) {
      result = result.plus(this.amount.times(call.getDuration().getSeconds() / this.seconds.getSeconds()));
    }

    return result;
  }
}
