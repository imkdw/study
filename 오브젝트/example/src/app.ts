import {
  DayOfWeek,
  PeriodCondition,
} from "./movie_rdd/conditions/period-condition.js";
import AmountDiscountPolicy from "./movie_rdd/discount-policy/amount-discount-policy.js";
import OverlappedDiscountPolicy from "./movie_rdd/discount-policy/overlapped-discount-poilcy.js";
import PercentDiscountPolicy from "./movie_rdd/discount-policy/percent-discount-policy.js";
import Duration from "./movie_rdd/duration.js";
import LocalTime from "./movie_rdd/local-time.js";
import Money from "./movie_rdd/money.js";
import Movie from "./movie_rdd/movie.js";
import SequenceCondition from "./movie_rdd/sequence-condition.js";

const movie = new Movie(
  "아바타",
  Duration.ofMinutes(120),
  Money.wons(10000),
  new OverlappedDiscountPolicy([
    new AmountDiscountPolicy(Money.wons(1000), [
      new PeriodCondition(
        DayOfWeek.TUESDAY,
        LocalTime.of(10, 0),
        LocalTime.of(12, 59)
      ),
      new SequenceCondition(2),
    ]),
    new PercentDiscountPolicy(0.2, [
      new PeriodCondition(
        DayOfWeek.TUESDAY,
        LocalTime.of(10, 0),
        LocalTime.of(12, 59)
      ),
      new SequenceCondition(2),
    ]),
  ])
);
