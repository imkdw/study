export class ChangeOrderService {
  constructor(private orderRepository: OrderRepository;) {

  }
  
  @Transactional()
  changeShippingInfo(id: OrderId, newShippingInfo: ShippingInfo, useNewSHippingAddrAsMemberAddr: boolean) {
    const order = this.orderRepository.findById(id);
    if (!order) {
      throw new Error('주문을 찾을 수 없습니다.');
    }
    order.shipTo(newShippingInfo);

    if (useNewSHippingAddrAsMemberAddr) {
      // 다른 애그리거트의 상태를 변경하는건 안됨
      this.orderer.getMemeber().changeAddress(shippingInfo.getAddress());
    }
  }
}