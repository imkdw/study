import DiscountCondition from "../conditions/discount-condition";
import Money from "../money";
import Screening from "../screening";
import DiscountPolicy from "./discount-policy";

export default class PercentDiscountPolicy extends DiscountPolicy {
  private percent: number;

  constructor(percent: number, conditions: DiscountCondition[]) {
    super(conditions);
    this.percent = percent;
  }

  protected getDiscountAmount(screening: Screening): Money {
    return screening.getMovieFee().times(this.percent);
  }
}
