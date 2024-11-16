import { prisma } from '../../../../common/persistence/prisma.js';
import { ActivityRepository } from '../../../application/port/out/activity.repository.js';
import { ActivityPrismaEntity } from './entities/activity-prisma.entity.js';

export default class ActivityRepositoryImpl implements ActivityRepository {
  constructor() {}

  async findByOwnerSince(
    ownerAccountId: number,
    since: Date,
  ): Promise<ActivityPrismaEntity[]> {
    return prisma.activity.findMany({
      where: {
        ownerAccountId: ownerAccountId,
        timestamp: {
          gte: since,
        },
      },
    });
  }

  async getDepositBalanceUntil(
    accountId: number,
    until: Date,
  ): Promise<number> {
    const result = await prisma.activity.aggregate({
      where: {
        targetAccountId: accountId,
        ownerAccountId: accountId,
        timestamp: {
          lte: until,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount;
  }

  async getWithdrawalBalanceUntil(
    accountId: number,
    until: Date,
  ): Promise<number> {
    const result = await prisma.activity.aggregate({
      where: {
        targetAccountId: accountId,
        ownerAccountId: {
          not: accountId,
        },
        timestamp: {
          lte: until,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount;
  }
}
