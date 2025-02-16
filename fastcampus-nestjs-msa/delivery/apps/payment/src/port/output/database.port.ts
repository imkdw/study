import { PaymentModel } from '../../domain/payment.domain';

export interface DatabaseOutputPort {
  savePayment(payment: PaymentModel): Promise<PaymentModel>;

  updatePayment(payment: PaymentModel): Promise<PaymentModel>;
}
