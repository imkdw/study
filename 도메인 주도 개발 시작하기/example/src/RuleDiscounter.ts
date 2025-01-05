import { OrderLine } from "./OrderLine.js";

export interface RuleDiscounter {
  applyRules(customer: Customer, orderLines: OrderLine[]): Money;
}
