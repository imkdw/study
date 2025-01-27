export class EventStoreHadler {
  constructor(private readonly eventStore: EventStore) {}

  // 구독필요
  handle(event: Event): void {
    this.eventStore.save(event);
  }
}
