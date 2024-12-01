class CustomerController {
  private readonly calculator: StatisticsCalculator;

  constructor(calculator: StatisticsCalculator) {
    this.calculator = calculator;
  }

  getStatistics(customerId: number): string {
    const { totalCost, totalWeight } = this.calculator.calculate(customerId);

    return `
      총 비용 : ${totalCost}
      총 무게 : ${totalWeight}
    `;
  }
}
