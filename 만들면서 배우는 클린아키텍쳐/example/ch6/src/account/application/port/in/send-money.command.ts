import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const AccountIdSchema = z.object({
  id: z.string().min(1),
});

const MoneySchema = z.object({
  amount: z.number().positive(),
});

const SendMoneyCommandSchema = z.object({
  sourceAccountId: AccountIdSchema,
  targetAccountId: AccountIdSchema,
  money: MoneySchema,
});

type AccountId = z.infer<typeof AccountIdSchema>;
type Money = z.infer<typeof MoneySchema>;

@Injectable()
/**
 * SendMoneyCommand는 유즈케이스 API의 일부이기 때문에 인커핑 포트 패키지에 속한다
 *
 * 유효성검증이 앱 코어에 남아있지만, 신성한 유스케이스 코드를 오염시키지는 않음
 */
export default class SendMoneyCommand {
  constructor(
    /**
     * Command에 포함된 멤버변수는 생성된 이후에 변경이 불가능하도록 상수화함
     */
    private readonly sourceAccountId: AccountId,
    private readonly targetAccountId: AccountId,
    private readonly money: Money,
  ) {
    SendMoneyCommandSchema.parse({
      sourceAccountId,
      targetAccountId,
      money,
    });
  }
}
