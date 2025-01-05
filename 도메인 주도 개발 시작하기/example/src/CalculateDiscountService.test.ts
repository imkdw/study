import { CalculateDiscountService } from "./CalculateDiscountService.js";
import { RuleDiscounter } from "./RuleDiscounter.js";

describe(CalculateDiscountService.name, () => {
  it("no_customer_then_throw_customer_not_found_exception", () => {
    // Given
    const stubRepo: jest.Mocked<CustomerRepository> = {
      findById: (customerId: string) => null,
    };

    const stubRule: jest.Mocked<RuleDiscounter> = {
      applyRules: () => Money.ZERO,
    };

    // When
    expect(() =>
      new CalculateDiscountService(stubRule, stubRepo).calculateDiscount(
        [],
        "no-customer"
      )
    ).toThrow(CustomerNoutFoundException);
  });
});
