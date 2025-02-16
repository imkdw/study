import { PaymentMethod } from '../entity/payment.entity';

export class PaymentEntity {
  paymentId: string;
  paymentMethod: PaymentMethod;
  paymentName: string;
  amount: number;

  constructor(param: { paymentId: string; paymentMethod: PaymentMethod; paymentName: string; amount: number }) {
    this.paymentId = param.paymentId;
    this.paymentMethod = param.paymentMethod;
    this.paymentName = param.paymentName;
    this.amount = param.amount;
  }
}
