import { Inject, Injectable, Param } from '@nestjs/common';
import { PaymentMethod, PaymentModel } from '../domain/payment.domain';
import { DatabaseOutputPort } from '../port/output/database.port';
import { PaymentOutputPort } from '../port/output/payment.output';
import { NetworkOutputPort } from '../port/output/network.port';

@Injectable()
export class PaymentService {
  constructor(
    @Inject('DATABASE_OUTPUT_PORT')
    private readonly databaseOutputPort: DatabaseOutputPort,

    @Inject('PAYMENT_OUTPUT_PORT')
    private readonly paymentOutputPort: PaymentOutputPort,

    @Inject('NETWORK_OUTPUT_PORT')
    private readonly networkOutputPort: NetworkOutputPort,
  ) {}
  async makePayment(param: {
    orderId: string;
    paymentMethod: PaymentMethod;
    userEmail: string;
    cardNumber: string;
    expiryYear: string;
    expiryMonth: string;
    birthOrRegistration: string;
    passwordTwoDigits: string;
    amount: number;
  }) {
    // 1. 파라미터로 도메인 모델 생성 -> Domain
    const payment = new PaymentModel(param);

    // 2. PaymentModel 저장 -> DB
    const savedPayment = await this.databaseOutputPort.savePayment(payment);

    // 3. 저장된 데이터의 아이디 설정 -> Domain
    payment.assignId(savedPayment.id);

    try {
      // 4. 결제 실행 -> HTTP
      await this.paymentOutputPort.processPayment(payment);

      // 5. 결제 데이터 업데이트 -> DB
      payment.processPayment();
      await this.databaseOutputPort.updatePayment(payment);
    } catch {
      // 7. 실패처리
      payment.rejectPayment();
      await this.databaseOutputPort.updatePayment(payment);
      return payment;
    }

    // 6. 알림 발송
    await this.networkOutputPort.sendNotification(payment.orderId, payment.userEmail);
  }
}
