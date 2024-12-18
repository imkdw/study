/**
 * 돈
 *
 * 금액과 관련된 다양한 계산을 구현하는 간단한 클래스
 */
export default class Money {
  static readonly ZERO = Money.wons(0);

  private readonly amount: number;

  constructor(amount: number) {
    this.amount = amount;
  }

  static wons(amount: number): Money {
    return new Money(amount);
  }

  plus(money: Money): Money {
    return new Money(this.amount + money.amount);
  }

  minus(money: Money): Money {
    return new Money(this.amount - money.amount);
  }

  times(percent: number) {
    return new Money(this.amount * percent);
  }

  isLessThan(money: Money): boolean {
    return this.amount < money.amount;
  }

  isGreaterThanOrEqual(money: Money): boolean {
    return this.amount >= money.amount;
  }
}
