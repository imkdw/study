import AccountId from '../../../domain/account-id.js';
import Account from '../../../domain/account.js';

export interface LoadAccountPort {
  loadAccount(accountId: AccountId, baselineDate: Date): Promise<Account>;
}
