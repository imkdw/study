import { DroolsRuleEngine } from "./DroolsRuleEngine.js";
import { OrderLine } from "./OrderLine.js";

export class CalculateDiscountService {
  private readonly ruleEngine: DroolsRuleEngine;

  constructor() {
    this.ruleEngine = new DroolsRuleEngine();
  }

  calculateDiscount(orderLines: OrderLine[], customerId: string) {
    const customer = findCustomer(customerId);

    const money = new MutableMoney(0);
    const facts = Array.from(customer, money);
    facts.addAll(orderLines);
    this.ruleEngine.evalute("discountCalculation", facts);
    return money.toImmutableMoney();
  }
}
