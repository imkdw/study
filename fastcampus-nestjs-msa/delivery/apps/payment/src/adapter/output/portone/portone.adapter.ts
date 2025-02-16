import { PaymentModel } from 'apps/payment/src/domain/payment.domain';
import { PaymentOutputPort } from 'apps/payment/src/port/output/payment.output';

export class PortOneAdapter implements PaymentOutputPort {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  processPayment(payment: PaymentModel): Promise<boolean> {
    return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
  }
}
