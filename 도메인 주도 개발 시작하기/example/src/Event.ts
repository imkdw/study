export abstract class Event {
  private readonly timestamp: number;

  constructor() {
    this.timestamp = new Date().getTime();
  }

  getTimestamp(): number {
    return this.timestamp;
  }
}

export class OrderCanceledEvent extends Event {
  constructor(private readonly orderNumber: string) {
    super();
  }

  getOrderNumber(): string {
    return this.orderNumber;
  }
}
