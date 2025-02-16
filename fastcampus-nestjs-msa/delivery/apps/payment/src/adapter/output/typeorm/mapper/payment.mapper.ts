import { PaymentModel } from 'apps/payment/src/domain/payment.domain';
import { PaymentEntity } from '../entity/payment.entity';

export class PaymentMapper {
  constructor(private readonly payment: PaymentEntity) {}

  toDomain(): PaymentModel {
    const payment = new PaymentModel({
      orderId: this.payment.orderId,
      paymentMethod: this.payment.paymentMethod,
      cardNumber: this.payment.cardNumber,
      expiryYear: this.payment.expiryYear,
      expiryMonth: this.payment.expiryMonth,
      birthOrRegistration: this.payment.birthOrRegistration,
      passwordTwoDigits: this.payment.passwordTwoDigits,
      amount: this.payment.amount,
      userEmail: this.payment.userEmail,
    });

    payment.assignId(this.payment.id);

    return payment;
  }
}
