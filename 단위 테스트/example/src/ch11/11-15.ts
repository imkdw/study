class CustomerController {
  private readonly calculator: StatisticsCalculator;
  private readonly gateway: IDeliveryGateway;

  constructor(calculator: StatisticsCalculator, gateway: IDeliveryGateway) {
    this.calculator = calculator;
    this.gateway = gateway;
  }

  getStatistics(customerId: number): string {
    const records = this.gateway.getDeliveries(customerId);
    const { totalCost, totalWeight } = this.calculator.calculate(records);

    return `
      총 비용 : ${totalCost}
      총 무게 : ${totalWeight}
    `;
  }
}

it("customer_with_no_delivery", () => {
  const stub: jest.Mocked<IDeliveryGateway> = {
    getDeliveries: jest.fn().mockReturnValue([]),
  };
  const calculator = new StatisticsCalculator();
  const sut = new CustomerController(calculator, stub);

  const result = sut.getStatistics(1);

  expect(result).toBe(`
      총 비용 : 0
      총 무게 : 0
    `);
});
