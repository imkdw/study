import Duration from "../movie_ddd/duration.js";
import Money from "../movie_ddd/money.js";
import Movie from "./movie.js";

export default class NoneDiscountMovie extends Movie {
  constructor(title: string, runningTime: Duration, fee: Money) {
    super(title, runningTime, fee, []);
  }

  protected calculateDiscountAmount(): Money {
    return Money.ZERO;
  }
}
