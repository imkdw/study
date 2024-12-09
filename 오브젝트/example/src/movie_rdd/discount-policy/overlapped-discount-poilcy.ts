import Money from "../money.js";
import Screening from "../screening.js";
import { DiscountPolicy } from "./discount-policy.js";

export default class OverlappedDiscountPolicy implements DiscountPolicy {
  private discountPolices: DiscountPolicy[];

  constructor(discountPolices: DiscountPolicy[]) {
    this.discountPolices = discountPolices;
  }

  calculateDiscountAmount(screeing: Screening): Money {
    let result = Money.ZERO;
    for (const discountPolicy of this.discountPolices) {
      result = result.plus(discountPolicy.calculateDiscountAmount(screeing));
    }
    return result;
  }
}
