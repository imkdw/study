import { Controller, Param, Post } from '@nestjs/common';
import { SendMoneyUseCase } from '../../../application/port/in/send-money.use-case.js';
import SendMoneyCommand from '../../../application/port/in/send-money.command.js';

/**
 * 송금을 위한 단일 엔드포인트 컨트롤러
 */
@Controller('accounts')
export default class SendMoneyController {
  constructor(private readonly sendMoneyUseCase: SendMoneyUseCase) {}

  @Post('send/:source_id/:target_id/:amount')
  sendMoeny(
    @Param('source_id') sourceId: number,
    @Param('target_id') targetId: number,
    @Param('amount') amount: number,
  ): void {
    const command = new SendMoneyCommand(
      new AccountId(sourceId),
      new AccountId(targetId),
      Money.of(amount),
    );

    this.sendMoneyUseCase.sendMoney(command);
  }
}
