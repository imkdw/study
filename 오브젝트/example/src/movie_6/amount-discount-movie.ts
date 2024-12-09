import Duration from "../movie_ddd/duration.js";
import Money from "../movie_ddd/money.js";
import { DiscountCondition } from "./discount-condition.js";
import Movie from "./movie.js";

export default class AmountDiscountMovie extends Movie {
  private discountAmount: Money;

  constructor(
    title: string,
    runningTime: Duration,
    fee: Money,
    discountConditions: DiscountCondition[],
    discountAmount: Money
  ) {
    super(title, runningTime, fee, discountConditions);
    this.discountAmount = discountAmount;
  }

  protected calculateDiscountAmount(): Money {
    return this.discountAmount;
  }
}
