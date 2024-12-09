import DiscountCondition from "../conditions/discount-condition";
import Money from "../money";
import Screening from "../screening";
import DefaultDiscountPolicy from "./default-discount-policy.js";

/**
 * 일정 금액을 할인해주는 금액 할인 정책
 */
export default class AmountDiscountPolicy extends DefaultDiscountPolicy {
  private discountAmount: Money;

  constructor(discountAmount: Money, conditions: DiscountCondition[]) {
    super(conditions);
    this.discountAmount = discountAmount;
  }

  protected getDiscountAmount(screening: Screening): Money {
    return this.discountAmount;
  }
}
