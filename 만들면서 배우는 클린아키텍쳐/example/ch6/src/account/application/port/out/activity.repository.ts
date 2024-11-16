import { ActivityPrismaEntity } from '../../../adapter/out/persistence/entities/activity-prisma.entity.js';

export interface ActivityRepository {
  findByOwnerSince(
    ownerAccountId: number,
    since: Date,
  ): Promise<ActivityPrismaEntity[]>;
  getDepositBalanceUntil(accountId: number, until: Date): Promise<number>;
  getWithdrawalBalanceUntil(accountId: number, until: Date): Promise<number>;
  save(activity: ActivityPrismaEntity): Promise<void>;
}
