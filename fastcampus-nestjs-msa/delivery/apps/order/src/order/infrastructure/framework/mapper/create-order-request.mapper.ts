import { OrderEntity } from '../../../domain/order.entity';
import { PaymentMethod } from '../../../entity/payment.entity';
import { CreateOrderDto } from '../../../usecase/dto/create-order.dto';
export class CreateOrderRequestMapper {
  constructor(private readonly createOrderDto: CreateOrderDto) {}

  toDomain(): OrderEntity {
    return new OrderEntity({
      customer: this.createOrderDto.customer,
      products: this.createOrderDto.products,
      deliveryAddress: this.createOrderDto.deliveryAddress,
      orderDate: new Date(),
      totalAmount: this.createOrderDto.totalAmount,
      status: OrderStatus.PENDING,
    });
  }

  private parsePaymentMethod() {
    switch (this.createOrderDto.payment.paymentMethod) {
      case 'card':
        return PaymentMethod.CARD;
      case 'bank':
        return PaymentMethod.BANK;
    }
  }
}
