import { CLIENT_RENEG_LIMIT } from "tls";
import { DayOfWeek, PeriodCondition } from "./movie/conditions/period-condition";
import AmountDiscountPolicy from "./movie/discount-policy/amount-discount-policy";
import NoneDiscountPolicy from "./movie/discount-policy/none-discount-policy";
import PercentDiscountPolicy from "./movie/discount-policy/percent-discount-policy";
import Duration from "./movie/duration";
import LocalTime from "./movie/local-time";
import Money from "./movie/money";
import Movie from "./movie/movie";
import SequenceCondition from "./movie/sequence-condition";

// Movie {
//   title: '아바타',
//   runningTime: Duration { milliseconds: 7200000 },
//   fee: Money { amount: 10000 },
//   discountPolicy: AmountDiscountPolicy {
//     conditions: [ [SequenceCondition], [SequenceCondition], [PeriodCondition] ],
//     discountAmount: Money { amount: 800 }
//   }
// }
const avatar = new Movie(
  "아바타",
  Duration.ofMinutes(120),
  Money.wons(10000),
  new AmountDiscountPolicy(Money.wons(800), [
    new SequenceCondition(1),
    new SequenceCondition(10),
    new PeriodCondition(DayOfWeek.MONDAY, LocalTime.of(10, 0), LocalTime.of(11, 59)),
  ])
);

// Movie {
//   title: '타이타닉',
//   runningTime: Duration { milliseconds: 10800000 },
//   fee: Money { amount: 11000 },
//   discountPolicy: PercentDiscountPolicy {
//     conditions: [ [PeriodCondition], [SequenceCondition], [PeriodCondition] ],
//     percent: 0.1
//   }
// }
const titanic = new Movie(
  "타이타닉",
  Duration.ofMinutes(180),
  Money.wons(11000),
  new PercentDiscountPolicy(0.1, [
    new PeriodCondition(DayOfWeek.TUESDAY, LocalTime.of(14, 0), LocalTime.of(16, 59)),
    new SequenceCondition(2),
    new PeriodCondition(DayOfWeek.THURSDAY, LocalTime.of(10, 0), LocalTime.of(13, 59)),
  ])
);
console.log(titanic);

// Movie {
//   title: '스타워즈',
//   runningTime: Duration { milliseconds: 12600000 },
//   fee: Money { amount: 10000 },
//   discountPolicy: NoneDiscountPolicy { conditions: [] }
// }
const starwars = new Movie("스타워즈", Duration.ofMinutes(210), Money.wons(10000), new NoneDiscountPolicy([]));
console.log(starwars);
