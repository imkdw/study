import { PaymentModel } from '../../domain/payment.domain';

export interface PaymentOutputPort {
  processPayment(payment: PaymentModel): Promise<boolean>;
}
