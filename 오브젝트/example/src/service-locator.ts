import AmountDiscountPolicy from "./movie_rdd/discount-policy/amount-discount-policy";

export default class ServiceLocator {
  private static soleInstance = new ServiceLocator();
  private discountPolicy: DiscountPolicy;

  static discountPolicy(): DiscountPolicy {
    return this.soleInstance.discountPolicy;
  }

  static provide(discountPolicy: DiscountPolicy): void {
    this.soleInstance.discountPolicy = discountPolicy;
  }
}

export default class Movie {
  private discountPolicy: DiscountPolicy;

  constructor(discountPolicy: DiscountPolicy) {
    this.discountPolicy = ServiceLocator.discountPolicy();
  }
}

ServiceLocator.provide(
  new AmountDiscountPolicy(Money.wons(1000), [
    new PeriodCondition(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(12, 59)),
    new SequenceCondition(2),
  ])
);
