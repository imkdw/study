import { PaymentModel } from '../../../../domain/payment.domain';
import { PaymentDocument } from '../document/payment.document';

export class PaymentDocumentMapper {
  constructor(private readonly paymentDocument: PaymentDocument) {}

  toDomain(): PaymentModel {
    const payment = new PaymentModel({
      orderId: this.paymentDocument.orderId,
      paymentMethod: this.paymentDocument.paymentMethod,
      cardNumber: this.paymentDocument.cardNumber,
      expiryYear: this.paymentDocument.expiryYear,
      expiryMonth: this.paymentDocument.expiryMonth,
      birthOrRegistration: this.paymentDocument.birthOrRegistration,
      passwordTwoDigits: this.paymentDocument.passwordTwoDigits,
      amount: this.paymentDocument.amount,
      userEmail: this.paymentDocument.userEmail,
    });

    payment.assignId(this.paymentDocument._id.toString());

    return payment;
  }
}
