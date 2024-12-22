export class Campain {
  private readonly events: DomainEvent[] = [];
  private messageBus: IMesageBus;

  deactive(reason: string): void {
    this.locations.forEach((l) => l.deactive(reason));
    this.isActive = false;

    // 이벤트 인스턴스화
    const newEvent = new CampainDeactivated(this.id, reason);

    // 새로운 이벤트 추가
    this.events.push(newEvent);

    // 메세지 버스에 발행
    this.messageBus.publish(newEvent);
  }
}
