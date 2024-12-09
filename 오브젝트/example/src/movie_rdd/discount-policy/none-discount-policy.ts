import Money from "../money";
import Screening from "../screening";
import { DiscountPolicy } from "./discount-policy.js";

export default class NoneDiscountPolicy implements DiscountPolicy {
  calculateDiscountAmount(screeing: Screening): Money {
    return Money.ZERO;
  }
}
