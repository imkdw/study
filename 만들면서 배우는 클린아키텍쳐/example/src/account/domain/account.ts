/**
 * 실제 계좌의 현재 스냅숏을 제공
 * 계좌에 대한 모든 입금/출금은 해당 엔티티에 포작됨
 */
export default class Account {
  private id: AccountId;

  /**
   * activityWindow의 첫번째 활동 바로 전의 잔고를 표현하는 금액
   */
  private baselineBalance: Money;

  /**
   * 지난 며칠 혹은 몇 주간의 계좌의 활동을 보유함
   * 모든 활동을 항상 메모리에 올리는것은 효율적이지 않음
   */
  private activityWindow: ActivityWindow;

  // getter, setter 생략

  /**
   * 계좌의 현재 잔고를 계산한다
   */
  calculateBalance(): Money {
    return Money.add(
      this.baselineBalance,
      this.activityWindow.calculateBalance(this.id),
    );
  }

  /**
   * 출금을 처리한다
   * 1. 만약 현재 출금이 가능한 상태가 아니라면 false를 반환한다
   * 2. 출금이 가능하다면 새로운 출금 활동을 생성하고 activityWindow에 추가한다
   * 3. true를 반환한다
   */
  withdraw(money: Money, tagetAccountId: AccountId): boolean {
    if (!mayWithdraw(money)) {
      return false;
    }

    const withdrawal = new Activity(
      this.id,
      this.id,
      tagetAccountId,
      new Date(),
      money,
    );

    this.activityWindow.addActivity(withdrawal);
    return true;
  }

  /**
   * 입금을 처리한다
   * 1. 새로운 입금 활동을 생성하고 activityWindow에 추가한다
   * 2. true를 반환한다
   */
  deposit(money: Money, sourceAccountId: AccountId): boolean {
    const deposit = new Activity(
      this.id,
      sourceAccountId,
      this.id,
      new Date(),
      money,
    );

    this.activityWindow.addActivity(deposit);
    return true;
  }

  /**
   * 출금이 가능한지 확인한다
   * 1. 현재 잔고와 출금 금액을 비교한다
   * 2. 만약 출금이 가능하다면 true를 반환한다
   * 3. 그렇지 않다면 false를 반환한다
   */
  private mayWithdraw(money: Money): boolean {
    return Money.add(this.calculateBalance(), money.negate()).isPositive();
  }
}
