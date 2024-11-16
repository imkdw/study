import { Injectable, NotFoundException } from '@nestjs/common';
import { LoadAccountPort } from '../../../application/port/out/load-account.port.js';
import { UpdateAccountStatePort } from '../../../application/port/out/update-account-state.port.js';
import { AccountRepository } from '../../../application/port/out/account.repository.js';
import { ActivityRepository } from '../../../application/port/out/activity.repository.js';
import AccountId from '../../../domain/account-id.js';
import Account from '../../../domain/account.js';
import ActivityMapper from './mappers/activity.mapper.js';

@Injectable()
export default class AccountPersistenceAdapter
  implements LoadAccountPort, UpdateAccountStatePort
{
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly activityRepository: ActivityRepository,
  ) {}

  async loadAccount(
    accountId: AccountId,
    baselineDate: Date,
  ): Promise<Account> {
    const account = await this.accountRepository.findById(accountId.getValue());
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const activites = await this.activityRepository.findByOwnerSince(
      accountId.getValue(),
      baselineDate,
    );

    const depositBalance = this.orZero(
      await this.activityRepository.getDepositBalanceUntil(
        accountId.getValue(),
        baselineDate,
      ),
    );

    const withrawalBalance = this.orZero(
      await this.activityRepository.getWithdrawalBalanceUntil(
        accountId.getValue(),
        baselineDate,
      ),
    );
  }

  private orZero(value: number): number {
    return value || 0;
  }

  async updateActivities(account: Account): Promise<void> {
    for (const activity of account.getActivityWindow().getActivities()) {
      if (activity.getId()) {
        await this.activityRepository.save(
          ActivityMapper.mapToPrismaEntity(activity),
        );
      }
    }
  }
}
