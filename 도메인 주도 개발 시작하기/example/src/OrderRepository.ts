interface OrderRepository {
  findByNumber(number: OrderNumber): Order;
  save(order: Order): void;
  delete(order: Order): void;
}
