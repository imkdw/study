import AccountId from './account-id.js';
import ActivityWindow from './activity-window.js';
import Money from './money.js';

/**
 * 간단한 데이터 클래스가 아니며 불변현성을 유지한다
 * Account 엔티티만 생성할 수 있는 팩토리 메소드를 외부에 노출한다
 */
export default class Account {
  constructor(
    private readonly id: AccountId,
    private readonly activityWindow: ActivityWindow,
    private readonly baselineBalance: Money,
  ) {}

  getActivityWindow(): ActivityWindow {
    return this.activityWindow;
  }

  static withoutId(
    baselineBalance: Money,
    activityWindow: ActivityWindow,
  ): Account {
    return new Account(null, activityWindow, baselineBalance);
  }

  static withId(
    id: AccountId,
    baselineBalance: Money,
    activityWindow: ActivityWindow,
  ): Account {
    return new Account(id, activityWindow, baselineBalance);
  }

  calculateBalance(): Money {
    return new Money();
  }

  withdraw(money: Money, targetAccountId: AccountId): void {
    // ...
  }

  deposit(money: Money, sourceAccountId: AccountId): void {
    // ...
  }
}
