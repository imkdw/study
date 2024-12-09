import DiscountCondition from "../conditions/discount-condition";
import Money from "../money";
import Screening from "../screening";
import DefaultDiscountPolicy from "./default-discount-policy.js";

export default class PercentDiscountPolicy extends DefaultDiscountPolicy {
  private percent: number;

  constructor(percent: number, conditions: DiscountCondition[]) {
    super(conditions);
    this.percent = percent;
  }

  protected getDiscountAmount(screening: Screening): Money {
    return screening.getMovieFee().times(this.percent);
  }
}
