import { Either } from "fp-ts/lib/Either";
import { UnvalidatedOrder } from "./order";
import { PlaceOrderError } from "./error";
import { PlaceOrderEvent } from "./event";

export type PlaceOrder = (i: UnvalidatedOrder) => Either<PlaceOrderError, PlaceOrderEvent>;
