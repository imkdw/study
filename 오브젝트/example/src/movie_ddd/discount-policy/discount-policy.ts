import Money from "../money";
import Screening from "../screening";

export interface DiscountPolicy {
  calculateDiscountAmount(screeing: Screening): Money;
}
