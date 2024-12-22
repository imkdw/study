export class Ticket {
  private domainEvents: DomainEvent[] = [];
  private state: TicketState;

  constructor(events: DomainEvent[]) {
    this.domainEvents = events;
  }

  appendEvent(event: IDomainEvent) {
    this.domainEvents.push(event);
    this.state.apply(event);
  }

  execute(cmd: ReuqestEscalation): void {
    if (this.state.isEscalated && this.state.remainingTimePercentage <= 0) {
      const escalatedEvent = new TicketEscalated(this.id, cmd.reason);
      this.appendEvent(escalatedEvent);
    }
  }
}
