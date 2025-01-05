import { DroolsRuleEngine } from "./DroolsRuleEngine.js";
import { OrderLine } from "./OrderLine.js";
import { RuleDiscounter } from "./RuleDiscounter.js";

export class CalculateDiscountService {
  constructor(
    private readonly ruleDiscounter: RuleDiscounter,
    private readonly customerRepository: CustomerRepository
  ) {}

  calculateDiscount(orderLines: OrderLine[], customerId: string) {
    const customer = findCustomer(customerId);
    return this.ruleDiscounter.applyRules(customer, orderLines);
  }

  private findCustomer(customerId: string) {
    const customer = this.customerRepository.findById(customerId);
    if (!customer) {
      throw new CustomerNotFoundException(customerId);
    }
    return customer;
  }
}
