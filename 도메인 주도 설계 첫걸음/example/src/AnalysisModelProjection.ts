interface ContactedEvent {
  type: "Contacted";
}

interface FollowupSetEvent {
  type: "FollowupSet";
}

interface ContactDetailsEvent {
  type: "ContactDetailsChanged";
}

interface OrderSubmittedEvent {
  type: "OrderSubmitted";
}

interface PaymentConfirmedEvent {
  type: "PaymentConfirmed";
}

type Event =
  | ContactedEvent
  | FollowupSetEvent
  | ContactDetailsEvent
  | OrderSubmittedEvent
  | PaymentConfirmedEvent;

export class AnalysisModelProjection {
  leadId: number;
  followups: number;
  status: LeadStatus;
  version: number;

  apply(event: Event) {
    switch (event.type) {
      case "Contacted":
        this.followups += 1;
        this.status = "Contacted";
        this.version += 1;
        break;
      case "FollowupSet":
        this.followups += 1;
        this.status = "FollowupSet";
        this.version += 1;
        break;
      case "ContactDetailsChanged":
        this.status = "ContactDetailsChanged";
        this.version += 1;
        break;
      case "OrderSubmitted":
        this.status = "OrderSubmitted";
        this.version += 1;
        break;
      case "PaymentConfirmed":
        this.status = "PaymentConfirmed";
        this.version += 1;
        break;
      default:
        const _exhaustiveCheck: never = event;
        throw new Error(`Unhandled event type: ${event.type}`);
    }
  }
}
