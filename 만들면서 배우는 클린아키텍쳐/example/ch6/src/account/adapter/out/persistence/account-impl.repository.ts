import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../../application/port/out/account.repository.js';
import { AccountPrismaEntity } from './entities/account-prisma.entity.js';
import { prisma } from '../../../../common/persistence/prisma.js';

@Injectable()
export default class AccountRepositoryImpl implements AccountRepository {
  constructor() {}

  async findById(accountId: number): Promise<AccountPrismaEntity> {
    return prisma.account.findUnique({
      where: {
        id: accountId,
      },
    });
  }
}
