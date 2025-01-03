export class CancelOrderService {
  cancelOrder(orderId: string) {
    const order = findOrderById(orderId);
    if (!order) {
      throw new OrderNotFoundException(orderId);
    }
    order.cancel();
  }
}
