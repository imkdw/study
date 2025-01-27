export class ShippingInfoChangedEvent {
  private orderNumber: string;
  private timestamp: number;
  private newShippingInfo: ShippingInfo;

  constructor(orderNumber: string, timestamp: number, newShippingInfo: ShippingInfo) {
    this.orderNumber = orderNumber;
    this.timestamp = new Date().getTime();
    this.newShippingInfo = newShippingInfo;
  }
}
