import { OrderStatus } from '../entity/order.entity';
import { CustomerEntity } from './customer.entity';
import { DeliveryAddressEntity } from './delivery-address.entity';
import { PaymentEntity } from './payment.entity';
import { ProductEntity } from './product.entity';

export class OrderEntity {
  id: string;
  customer: CustomerEntity;
  payment: PaymentEntity;
  products: ProductEntity[];
  deliveryAddress: DeliveryAddressEntity;
  orderDate: Date;
  totalAmount: number;
  status: OrderStatus;

  constructor(param: {
    customer: CustomerEntity;
    products: ProductEntity[];
    deliveryAddress: DeliveryAddressEntity;
    orderDate: Date;
    totalAmount: number;
    status: OrderStatus;
  }) {
    this.customer = param.customer;
    this.products = param.products;
    this.deliveryAddress = param.deliveryAddress;
  }

  setId(id: string) {
    this.id = id;
  }

  setPayment(payment: PaymentEntity) {
    if (!this.id) {
      throw new Error('ID가 없는 주문에는 결제 설정이 불가능함');
    }

    this.payment = payment;
  }

  calculateTotalAmount() {
    if (this.products.length === 0) {
      throw new Error('주문 상품이 없습니다.');
    }

    const total = this.products.reduce((acc, product) => acc + product.price, 0);

    if (total <= 0) {
      throw new Error('주문 금액이 0원 이하입니다.');
    }

    this.totalAmount = total;
  }

  processPayment() {
    if (!this.payment) {
      throw new Error('결제 정보가 없습니다.');
    }

    if (this.products.length === 0) {
      throw new Error('주문 상품이 없습니다.');
    }

    if (!this.deliveryAddress) {
      throw new Error('배송 주소가 없습니다.');
    }

    if (!this.totalAmount) {
      throw new Error('결제를 위해서는 결제 총액이 필수입니다');
    }

    if (this.status !== OrderStatus.PENDING) {
      throw new Error('결제 처리 불가능한 주문 상태입니다.');
    }

    this.status = OrderStatus.PAYMENT_PROCESSED;
  }

  cancelOrder() {
    this.status = OrderStatus.PAYMENT_CANCELED;
  }

  startDelivery() {
    if (this.status !== OrderStatus.PAYMENT_PROCESSED) {
      throw new Error('배송 처리 불가능한 주문 상태입니다.');
    }

    this.status = OrderStatus.DELIVERY_STARTED;
  }

  finishDelivery() {
    if (this.status !== OrderStatus.DELIVERY_STARTED) {
      throw new Error('배송 처리 불가능한 주문 상태입니다.');
    }

    this.status = OrderStatus.DELIVERY_DONE;
  }
}
