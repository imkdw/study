import { Controller, Get, Param, Post } from '@nestjs/common';
import { SendMoneyUseCase } from '../../../application/port/in/send-money.use-case.js';
import SendMoneyCommand from '../../../application/port/in/send-money.command.js';
import { GetAccountBalanceQuery } from '../../../application/port/in/get-account-balance.query.js';

/**
 * 여러개의 엔드포인트가 하나의 컨트롤러에 모두 포함된다
 */
@Controller('accounts')
export default class AccountController {
  constructor(
    private readonly sendMoneyUseCase: SendMoneyUseCase,
    private readonly getAccountBalanceQuery: GetAccountBalanceQuery,
  ) {}

  @Get(':id/balance')
  async getBalance(@Param('id') id: number): Promise<number> {
    return this.getAccountBalanceQuery.getAccountBalance(id);
  }

  @Post('send/:source_id/:target_id/:amount')
  sendMoeny(
    @Param('source_id') sourceId: number,
    @Param('target_id') targetId: number,
    @Param('amount') amount: number,
  ): void {
    this.sendMoneyUseCase.sendMoney(
      new SendMoneyCommand(sourceId, targetId, amount),
    );
  }
}
