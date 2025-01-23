export class TransferService {
  transfer(fromAcc: Account, toAcc: Account, amounts: Money) {
    fromAcc.withdraw(amounts);
    toAcc.credit(amounts);
  }
}
