import { OrderEntity } from '../domain/order.entity';
import { ProductOutputPort } from '../port/output/product-output.port';
import { UserOutputPort } from '../port/output/user-output.port';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderOutputPort } from '../port/output/order-output.port';
import { PaymentOutputPort } from '../port/output/payment-output.port';

export class CreateOrderUseCase {
  constructor(
    private readonly userOutputPort: UserOutputPort,
    private readonly productOutputPort: ProductOutputPort,
    private readonly orderOutputPort: OrderOutputPort,
    private readonly paymentOutputPort: PaymentOutputPort,
  ) {}

  async execute(dto: CreateOrderDto) {
    // 1) 유저를 가져옴
    const user = await this.userOutputPort.getUserById(dto.userId);

    // 2) 상품 정보를 가져옴
    const products = await this.productOutputPort.getProductsByIds(dto.productIds);

    // 3) 주문 생성
    const order = new OrderEntity({
      customer: user,
      products: products,
      deliveryAddress: dto.address,
    });

    // 4) 총액 계정
    order.calculateTotalAmount();

    // 5) 생성된 주문 디비 저장
    await this.orderOutputPort.createOrder(order);

    // 6) 생성된 주문 아이디 저장
    order.setId(orderId);

    try {
      const 
    } catch {}
  }
}
