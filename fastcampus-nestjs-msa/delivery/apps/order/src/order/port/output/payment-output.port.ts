import { OrderEntity } from '../../domain/order.entity';

export interface PaymentOutputPort {
  processPayment(order: OrderEntity): Promise<void>;
}
