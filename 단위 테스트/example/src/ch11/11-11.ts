class StatisticsCalculator {
  calculate(customerId: number): { totalWeight: number; totalCost: number } {
    const records = this.getDeliveries(customerId);
    const totalWeight = records.reduce((acc, cur) => acc + cur.weight, 0);
    const totalCost = records.reduce((acc, cur) => acc + cur.cost, 0);
    return { totalWeight, totalCost };
  }

  getDeliveries(customerId: number): DeliveryRecord[] {
    // 프로세스 외부 의존성 호출을 통한 배달 목록 조회
  }
}
