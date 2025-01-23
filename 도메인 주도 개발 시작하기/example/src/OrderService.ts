export class OrderService {
  constructor(
    private readonly discountCalculateService: DiscountCalulateService,
    private readonly orderRepository: OrderRepository
  ) {}

  placeOrder(orderRequest: OrderRequest) {
    const orderNo = this.orderRepository.nextId();
    const order = this.createOrder();
    this.orderRepository.save(order);
    return orderNo;
  }

  private createOrder(orderNo: OrderNo, orderRequest: OrderRequest) {
    // ...
  }
}
