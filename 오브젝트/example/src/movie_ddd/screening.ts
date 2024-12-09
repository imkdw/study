import LocalTime from "./local-time.js";
import Money from "./money.js";
import Movie, { MovieType } from "./movie.js";

export default class Screening {
  private movie: Movie;
  private sequence: number;
  private whenScreened: LocalTime;

  // constructor...

  getMovie(): Movie {
    return this.movie;
  }

  getWhenScreened(): LocalTime {
    return this.whenScreened;
  }

  getSequence(): number {
    return this.sequence;
  }

  calculateFee(audienceCount: number): Money {
    switch (this.movie.getMovieType()) {
      case MovieType.AMOUNT_DISCOUNT:
        if (this.movie.isDiscountable(this.whenScreened, this.sequence)) {
          return this.movie.calculateAmountDiscountedFee().times(audienceCount);
        }
        break;

      case MovieType.PERCENT_DISCOUNT:
        if (this.movie.isDiscountable(this.whenScreened, this.sequence)) {
          return this.movie
            .calculatePercentDiscountedFee()
            .times(audienceCount);
        }
        break;

      case MovieType.NONE_DISCOUNT:
        return this.movie.getFee().times(audienceCount);
        break;
    }

    return this.movie.calculateNoneDiscountedFee().times(audienceCount);
  }
}
