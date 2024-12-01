it("customer_with_no_delivery", () => {
  class TestStatisticsCalculator extends StatisticsCalculator {
    constructor() {
      super();
      this.getDeliveries = jest
        .fn()
        .mockImplementation((customerId: number) => {
          if (customerId === 1) {
            return [];
          }
          return [];
        });
    }
  }

  const sut = new CustomerController(stub);

  const result = sut.getStatistics(1);

  expect(result).toBe(`
      총 비용 : 0
      총 무게 : 0
    `);
});
