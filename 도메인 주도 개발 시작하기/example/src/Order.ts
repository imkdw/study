export class Order {
  private orderer: Orderer;

  constructor(orderer: Orderer) {
    this.orderer = orderer;
  }

  shipTo(shippingInfo: ShippingInfo, useNewSHippingAddrAsMemberAddr: boolean) {
    verifyNotShippedYet();
    setShippingInfo(shippingInfo);
    if (useNewSHippingAddrAsMemberAddr) {
      // 다른 애그리거트의 상태를 변경하는건 안됨
      this.orderer.getMemeber().changeAddress(shippingInfo.getAddress());
    }
  }
}
