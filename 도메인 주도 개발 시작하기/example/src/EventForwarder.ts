export class EventForwarder {
  private static readonly DEFAULT_LIMIT_SIZE = 100;

  private limitSize = EventForwarder.DEFAULT_LIMIT_SIZE;

  constructor(
    private readonly eventStore: EventStore,
    private readonly offsetStore: OffsetStore,
    private readonly eventSender: EventSender
  ) {}

  @Cron("0 0 * * * *")
  getAndSend(): void {
    // ...
  }

  private getNextOffset(): number {
    // ...
  }

  private sendEvent(): number {
    // ...
  }

  private saveNextOffset(nextOffset: number): void {
    // ...
  }
}
