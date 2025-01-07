export default class CancelOrderService {
  constructor(private readonly orderRepository: OrderRepository) {}

  cancel(number: OrderNumber): void {
    const order = this.orderRepository.findByNumber(number);
    if (!order) {
      throw new Error(`주문 번호 ${number}의 주문을 찾을 수 없습니다.`);
    }

    order.cancel();
  }
}
