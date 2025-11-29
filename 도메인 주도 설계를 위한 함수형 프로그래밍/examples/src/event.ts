import { Undefined } from "./common.js";

type AcknowledgmentSent = Undefined;
type OrderPlaced = Undefined;
type BillableOrderPlaced = Undefined;

export class PlaceOrderEvent {
  constructor(
    readonly acknowledgmentSent: AcknowledgmentSent,
    readonly orderPlaced: OrderPlaced,
    readonly billableOrderPlaced: BillableOrderPlaced
  ) {}
}
