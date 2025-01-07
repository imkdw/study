export default class Order {
  private number: OrderNo;
  private orderer: Orderer;
  private shippingInfo: ShippingInfo;

  constructor(number: OrderNo, orderer: Orderer, shippingInfo: ShippingInfo) {
    this.number = number;
    this.orderer = orderer;
    this.shippingInfo = shippingInfo;
  }

  // 기능을 함께 제공
  changeShippingInfo(shippingInfo: ShippingInfo) {
    // ...
  }
}
