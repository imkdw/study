import { Entity, Undefined, ValueObject } from "./common";
import { CustomerId, OrderId } from "./id";

type CustomerInfo = Undefined;
type ShippingAddress = Undefined;
type BillingAddress = Undefined;
type Price = Undefined;
type BillingAmount = Undefined;
type OrderLine = Undefined;

export class Order extends Entity<OrderId> {
  constructor(
    readonly orderId: OrderId,
    readonly customerId: CustomerId,
    readonly orderLines: OrderLine[],
    readonly shippingAddress: ShippingAddress,
    readonly billingAddress: BillingAddress,
    readonly amountToBill: BillingAmount
  ) {
    super();
  }

  protected isSameClass<T extends Entity<never>>(obj: unknown): obj is T {
    return obj instanceof Order;
  }
}

export class UnvalidatedOrder extends ValueObject {
  constructor(
    readonly orderId: string,
    readonly customerInfo: CustomerInfo,
    readonly shippingAddress: ShippingAddress
  ) {
    super();
  }
}
