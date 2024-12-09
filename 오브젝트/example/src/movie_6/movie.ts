import Duration from "../movie_ddd/duration.js";
import Money from "../movie_ddd/money.js";
import { DiscountCondition } from "./discount-condition.js";
import Screening from "./screening.js";

export default abstract class Movie {
  private title: string;
  private runningTime: Duration;
  private fee: Money;
  private discountConditions: DiscountCondition[];

  constructor(
    title: string,
    runningTime: Duration,
    fee: Money,
    discountConditions: DiscountCondition[]
  ) {
    this.title = title;
    this.runningTime = runningTime;
    this.fee = fee;
    this.discountConditions = discountConditions;
  }

  calculateMovieFee(screening: Screening): Money {
    if (this.isDiscountable(screening)) {
      return this.fee.minus(this.calculateDiscountAmount());
    }

    return this.fee;
  }

  protected getFee(): Money {
    return this.fee;
  }

  private isDiscountable(screening: Screening): boolean {
    return this.discountConditions.some((condition) =>
      condition.isSatisfiedBy(screening)
    );
  }

  protected abstract calculateDiscountAmount(): Money;
}
