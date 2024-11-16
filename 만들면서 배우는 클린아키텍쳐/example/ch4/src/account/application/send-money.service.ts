import { Injectable } from '@nestjs/common';
import { SendMoneyUseCase } from './port/in/send-money.use-case.js';
import { LoadAccountPort } from './port/out/load-account.port.js';
import { UpdateAccountStatePort } from './port/out/update-account-state.port.js';
import SendMoneyCommand from './port/in/send-money.command.js';

@Injectable()
/**
 * 서비스는 인커밍 포트 인터페이스인 SendMoneyUseCase를 구현
 */
export default class SendMoneyService implements SendMoneyUseCase {
  constructor(
    /**
     * 영속성 계층으로 부터 계좌를 불러오가 위한 아웃고잉 포트 인터페이스
     */
    private readonly loadAccountPort: LoadAccountPort,

    private readonly accountLock: AccountLock,

    /**
     * 영속성 게층에 계좌 상태 업데이트를 위한 아웃고잉 포트 인터페이스
     */
    private readonly updateAccountStatePort: UpdateAccountStatePort,
  ) {}

  sendMoney(command: SendMoneyCommand): boolean {
    // TODO: 비즈니스 규칙 검증
    // TODO: 모델 상태 조작
    // TODO: 출력 값 반환
  }
}
