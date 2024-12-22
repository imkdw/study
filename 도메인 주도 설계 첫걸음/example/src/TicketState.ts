interface TicketInitializedEvent {
  type: "TicketInitialized";
}

interface TicketEscalatedEvent {
  type: "TicketEscalated";
}

export class TicketState {
  id: TicketId;
  version: number;
  isEscalated: boolean;

  apply(event: IDomainEvent) {
    switch (event.type) {
      case "TicketInitialized":
        this.id = event.id;
        this.version = 0;
        this.isEscalated = false;
        break;
      case "TicketEscalated":
        this.isEscalated = true;
        break;
      default:
        const _exhaustiveCheck: never = event;
        throw new Error(`Unhandled event type: ${event.type}`);
    }
  }
}
