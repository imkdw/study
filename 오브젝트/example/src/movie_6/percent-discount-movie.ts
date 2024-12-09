import Duration from "../movie_ddd/duration.js";
import Money from "../movie_ddd/money.js";
import { DiscountCondition } from "./discount-condition.js";
import Movie from "./movie.js";

export default class PercentDiscountMovie extends Movie {
  private percent: number;

  constructor(
    percent: number,
    title: string,
    runningTime: Duration,
    fee: Money,
    discountConditions: DiscountCondition[]
  ) {
    super(title, runningTime, fee, discountConditions);
    this.percent = percent;
  }

  protected calculateDiscountAmount(): Money {
    return this.getFee().times(this.percent);
  }
}
