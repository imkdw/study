import Call from "./call.js";
import Money from "./money.js";

export default abstract class Phone {
  private calls: Call[];
  private taxRate: number; // 추가

  constructor(calls: Call[], taxRate: number) {
    this.calls = calls;
    this.taxRate = taxRate;
  }

  calculateFee() {
    let result = Money.ZERO;
    for (const call of this.calls) {
      result = result.plus(this.calculateCallFee(call));
    }
    return result;
  }

  protected abstract calculateCallFee(call: Call): Money;
}
