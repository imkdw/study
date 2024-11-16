import SendMoneyCommand from './send-money.command.js';

export interface SendMoneyUseCase {
  sendMoney(command: SendMoneyCommand): boolean;
}
