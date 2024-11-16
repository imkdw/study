import Account from '../../../domain/account.js';

export interface UpdateAccountStatePort {
  updateActivities(account: Account): Promise<void>;
}
