class Customer {
  private status: CustomerStatus = CustomerStatus.Regular;

  promote() {
    this.status = CustomerStatus.preferred;
  }

  getDiscount() {
    return this.status === CustomerStatus.preferred ? 0.05 : 0;
  }
}

enum CustomerStatus {
  Regular,
  preferred,
}

it("regular_customer_have_no_discount", () => {
  const customer = new Customer();

  const sut = customer.getDiscount();

  expect(sut).toBe(0);
});

it("preferred_customer_have_discount", () => {
  const customer = new Customer();
  customer.promote();

  const sut = customer.getDiscount();

  expect(sut).toBe(0.05);
});
