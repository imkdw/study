import { OrderEntity } from '../../domain/order.entity';

export interface OrderOutputPort {
  createOrder(order: OrderEntity): Promise<OrderEntity>;
}
