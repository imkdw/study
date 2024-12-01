interface IDeliveryGateway {
  getDeliveries(customerId: number): DeliveryRecord[];
}

class DeliveryGateway implements IDeliveryGateway {
  getDeliveries(customerId: number): DeliveryRecord[] {
    // 프로세스 외부 의존성 호출을 통한 배달 목록 조회
    return [];
  }
}

class StatisticsCalculator {
  calculate(recores: DeliveryRecord[]) {
    const totalWeight = records.reduce((acc, cur) => acc + cur.weight, 0);
    const totalCost = records.reduce((acc, cur) => acc + cur.cost, 0);
    return { totalWeight, totalCost };
  }
}
