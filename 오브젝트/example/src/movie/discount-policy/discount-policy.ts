import DiscountCondition from "../conditions/discount-condition";
import Money from "../money";
import Screening from "../screening";

/**
 * 추상화된 할인정책 클래스
 *
 */
export default abstract class DiscountPolicy {
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
