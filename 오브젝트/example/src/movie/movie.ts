import DiscountPolicy from "./discount-policy/discount-policy";
import Duration from "./duration";
import Money from "./money";
import Screening from "./screening";

/**
 * 영화 개념
 */
export default class Movie {
  private title: string;
  private runningTime: Duration;
  private fee: Money;
  private discountPolicy: DiscountPolicy; // 내부에는 여러개의 조건이 존재함

  constructor(title: string, runningTime: Duration, fee: Money, discountPolicy: DiscountPolicy) {
    this.title = title;
    this.runningTime = runningTime;
    this.fee = fee;
    this.discountPolicy = discountPolicy;
  }

  getFee(): Money {
    return this.fee;
  }

  calculateMoviePrice(screening: Screening): Money {
    return this.fee.minus(this.discountPolicy.calculateDiscountAmount(screening));
  }
}
