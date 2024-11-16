import { Controller } from '@nestjs/common';
import { SendMoneyUseCase } from '../../../application/port/in/send-money.use-case.js';
import SendMoneyCommand from '../../../application/port/in/send-money.command.js';

@Controller()
export default class AccountController {
  constructor(private readonly sendMoneyUseCase: SendMoneyUseCase) {}

  sendMoeny() {
    const command = new SendMoneyCommand();
  }
}
