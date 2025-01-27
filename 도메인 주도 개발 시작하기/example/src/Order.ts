import { ShippingInfoChangedEvent } from "./ShippingInfoChangedEvent.js";

export class Order {
  constructor(private readonly eventEmitter: EventEmitter) {}

  changeShippingInfo(newShippingInfo: ShippingInfo): void {
    // validate...
    // change status...
    this.eventEmitter.emit(
      ShippingInfoChangedEvent.name,
      new ShippingInfoChangedEvent(this.orderNumber, new Date().getTime(), newShippingInfo)
    );
  }
}
