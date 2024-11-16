import { Injectable } from '@nestjs/common';
import { GetAccountBalanceQuery } from './port/in/get-account-balance.query.js';
import { LoadAccountPort } from './port/out/load-account.port.js';

@Injectable()
export default class GetAccountBalanceService
  implements GetAccountBalanceQuery
{
  constructor(private readonly loadAccountPort: LoadAccountPort) {}

  getAccountBalance(accountId: string): number {
    return this.loadAccountPort.loadAccount(accountId).calculateBalance();
  }
}
