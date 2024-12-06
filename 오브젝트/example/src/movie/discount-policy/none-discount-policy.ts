import Money from "../money";
import Screening from "../screening";
import DiscountPolicy from "./discount-policy";

export default class NoneDiscountPolicy extends DiscountPolicy {
  protected getDiscountAmount(screening: Screening): Money {
    return Money.ZERO;
  }
}
