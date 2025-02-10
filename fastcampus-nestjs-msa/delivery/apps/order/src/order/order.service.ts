import { Inject, Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { ClientProxy, Transport } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { NOTIFICATION_SERVICE, PAYMENT_SERVICE, PRODUCT_SERVICE, USER_SERVICE } from '@app/common';
import { PaymentCanceledException } from './exception/payment-canceled.exception';
import { Product } from './entity/product.entity';
import { Customer } from './entity/customer.entity';
import { DeliveryAddress } from './entity/delivery-address.entity';
import { Model } from 'mongoose';
import { Order, OrderStatus } from './entity/order.entity';
import { InjectModel } from '@nestjs/mongoose';
import { PaymentDto } from './dto/payment.dto';
import { PaymentStatus } from '../../../payment/src/payment/entity/payment.entity';
import { PaymentFailedException } from './exception/payment-failed.exception';

@Injectable()
export class OrderService {
  constructor(
    @Inject(USER_SERVICE) private readonly userService: ClientProxy,
    @Inject(PRODUCT_SERVICE) private readonly productService: ClientProxy,
    @Inject(PAYMENT_SERVICE) private readonly paymentService: ClientProxy,
    @Inject(NOTIFICATION_SERVICE) private readonly notificationService: ClientProxy,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
  ) {}

  async createOrder(dto: CreateOrderDto, token: string) {
    const { address, payment, productIds } = dto;

    // 1) 유저 정보 가져오기
    const user = await this.getUserFromToken(token);

    // 2) 상품 정보 가져오기
    const products = await this.getProductsByIds(productIds);

    // 3) 총 금액 계산
    const totalAmount = this.calculateTotalAmount(products);

    // 4) 가격 비교
    this.validateTotalAmount(totalAmount, payment.amount);

    // 5) 주문 생성 - DB 추가
    const customer = this.createCustomer(user);
    const order = await this.createNewOrder(customer, products, address, payment);

    // 6) 결제 처리
    await this.processPayment(order._id.toString(), payment, user.email);

    // 7) 결과 반환
    return this.orderModel.findById(order._id);
  }

  private async getUserFromToken(token: string) {
    const resp = await lastValueFrom(
      this.userService.send({ cmd: 'parse_bearer_token', transport: Transport.TCP }, { token }),
    );

    if (resp.status === 'error') {
      throw new PaymentCanceledException(resp);
    }

    const userId = resp.data.id;

    const uResp = await lastValueFrom(
      this.userService.send({ cmd: 'get_user_info', transport: Transport.TCP }, { userId }),
    );

    return uResp.data;
  }

  private async getProductsByIds(productIds: string[]): Promise<Product[]> {
    const resp = await lastValueFrom(
      this.productService.send({ cmd: 'get_products_info', transport: Transport.TCP }, { productIds }),
    );

    if (resp.status === 'error') {
      throw new PaymentCanceledException(resp);
    }

    return resp.data.map(
      (product): Product => ({
        productId: product.id,
        name: product.name,
        price: product.price,
      }),
    );
  }

  private calculateTotalAmount(products: Product[]) {
    return products.reduce((acc, product) => acc + product.price, 0);
  }

  private validateTotalAmount(totalA: number, totalB: number) {
    if (totalA !== totalB) {
      throw new PaymentCanceledException('결제하려는 금액이 변경되었습니다');
    }
  }

  private createCustomer(user: { id: string; email: string; name: string }): Customer {
    return {
      customerId: user.id,
      email: user.email,
      name: user.name,
    };
  }

  private async createNewOrder(
    customer: Customer,
    products: Product[],
    deliveryAddress: DeliveryAddress,
    payment: PaymentDto,
  ): Promise<Order> {
    return this.orderModel.create({ customer, products, deliveryAddress, payment });
  }

  private async processPayment(orderId: string, payment: PaymentDto, userEmail: string) {
    try {
      const response = await lastValueFrom(
        this.paymentService.send(
          { cmd: 'make_payment', transport: Transport.TCP },
          {
            ...payment,
            userEmail,
            orderId,
          },
        ),
      );

      if (response.status === 'error') {
        throw new PaymentCanceledException(response);
      }

      const isPaid = response.data.paymentStatus === PaymentStatus.APPROVED;
      const orderStatus = isPaid ? OrderStatus.PAYMENT_PROCESSED : OrderStatus.PAYMENT_FAILED;

      if (orderStatus === OrderStatus.PAYMENT_FAILED) {
        throw new PaymentCanceledException(response);
      }
    } catch (e) {
      if (e instanceof PaymentFailedException) {
        await this.orderModel.findByIdAndUpdate(orderId, {
          status: OrderStatus.PAYMENT_FAILED,
        });
      }
    }
  }
}
