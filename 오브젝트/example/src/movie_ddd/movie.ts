import DiscountCondition, { DiscountConditionType } from "./conditions/discount-condition.js";
import Duration from "./duration.js";
import LocalTime from "./local-time.js";
import Money from "./money.js";

export const MovieType = {
  AMOUNT_DISCOUNT: "AMOUNT_DISCOUNT", // 금액 할인 정책
  PERCENT_DISCOUNT: "PERCENT_DISCOUNT", // 비율 할인 정책
  NONE_DISCOUNT: "NONE_DISCOUNT", // 미적용
} as const;

export type MovieType = (typeof MovieType)[keyof typeof MovieType];

export default class Movie {
  /**
   * 기존 책임 주도 설계에서 정의된 상태들
   *
   * title: 영화 제목
   * runningTime: 영화 상영 시간
   * fee: 영화 요금
   * discountConditions: 할인 조건
   */
  title: string;
  runningTime: Duration;
  fee: Money;
  discountConditions: DiscountCondition[];

  /**
   * 데이터 주도 설계에서 추가된 상태들
   *
   * movieType: 영화 유형
   * discountAmount: 할인 금액
   * discountPercent: 할인 비율
   */
  movieType: MovieType;
  discountAmount: Money;
  discountPercent: number;

  constructor(
    title: string,
    runningTime: Duration,
    fee: Money,
    discountConditions: DiscountCondition[],
    movieType: MovieType,
    discountAmount: Money,
    discountPercent: number
  ) {
    this.title = title;
    this.runningTime = runningTime;
    this.fee = fee;
    this.discountConditions = discountConditions;
    this.movieType = movieType;
    this.discountAmount = discountAmount;
    this.discountPercent = discountPercent;
  }

  // getters...
  getDiscountConditions(): DiscountCondition[] {
    return this.discountConditions;
  }

  getMovieType(): MovieType {
    return this.movieType;
  }

  getDiscountAmount(): Money {
    return this.discountAmount;
  }

  getFee(): Money {
    return this.fee;
  }

  getDiscountPercent() {
    return this.discountPercent;
  }

  // setters...

  calculateAmountDiscountedFee(): Money {
    if (this.movieType !== MovieType.AMOUNT_DISCOUNT) {
      throw new Error("할인 정책이 금액 할인이 아닙니다.");
    }

    return this.fee.minus(this.discountAmount);
  }

  calculatePercentDiscountedFee(): Money {
    if (this.movieType !== MovieType.PERCENT_DISCOUNT) {
      throw new Error("할인 정책이 비율 할인이 아닙니다.");
    }

    return this.fee.times(this.discountPercent);
  }

  calculateNoneDiscountedFee(): Money {
    if (this.movieType !== MovieType.NONE_DISCOUNT) {
      throw new Error("할인 정책이 미적용이 아닙니다.");
    }

    return this.fee;
  }

  isDiscountable(whenScreened: LocalTime, sequence: number): boolean {
    for (const condition of this.discountConditions) {
      if (condition.getType() === DiscountConditionType.PERIOD) {
        if (condition.isDiscountable(whenScreened.getDayOfWeek(), whenScreened.toLocalTime())) {
          return true;
        }
      } else {
        if (condition.isDiscountable(sequence)) {
          return true;
        }
      }
    }

    return false;
  }
}
