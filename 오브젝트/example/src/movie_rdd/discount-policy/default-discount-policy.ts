import DiscountCondition from "../conditions/discount-condition.js";
import Money from "../money.js";
import Screening from "../screening.js";
import { DiscountPolicy } from "./discount-policy.js";

export default abstract class DefaultDiscountPolicy implements DiscountPolicy {
  /**
   * 할인 조건들
   */
  private conditions: DiscountCondition[] = [];

  constructor(conditions: DiscountCondition[]) {
    this.conditions = conditions;
  }

  calculateDiscountAmount(screening: Screening): Money {
    for (const condition of this.conditions) {
      if (condition.isSatisfiedBy(screening)) {
        return this.getDiscountAmount(screening);
      }
    }

    return Money.ZERO;
  }

  protected abstract getDiscountAmount(screening: Screening): Money;
}
