interface LeadInitialized {
  type: "LeadInitialized";
  leadId: number;
  firstName: string;
  lastName: string;
  phoneNumber: PhoneNumber;
}

interface ContactDetailsChanged {
  type: "ContactDetailsChanged";
  firstName: string;
  lastName: string;
  phoneNumber: PhoneNumber;
}

interface Contacted {
  type: "Contacted";
}

interface FollowupSet {
  type: "FollowupSet";
}

interface OrderSubmitted {
  type: "OrderSubmitted";
}

interface PaymentConfirmed {
  type: "PaymentConfirmed";
}

// 모든 이벤트 타입을 합친 유니온 타입을 정의합니다
type LeadEvent =
  | LeadInitialized
  | ContactDetailsChanged
  | Contacted
  | FollowupSet
  | OrderSubmitted
  | PaymentConfirmed;

class LeadSearchModelProjection {
  private leadId: number = 0;
  private firstNames: Set<string> = new Set<string>();
  private lastNames: Set<string> = new Set<string>();
  private phoneNumbers: Set<PhoneNumber> = new Set<PhoneNumber>();
  private version: number = 0;

  apply(event: LeadEvent): void {
    switch (event.type) {
      case "LeadInitialized":
        this.leadId = event.leadId;
        this.firstNames = new Set<string>();
        this.lastNames = new Set<string>();
        this.phoneNumbers = new Set<PhoneNumber>();
        this.firstNames.add(event.firstName);
        this.lastNames.add(event.lastName);
        this.phoneNumbers.add(event.phoneNumber);
        this.version = 0;
        break;

      case "ContactDetailsChanged":
        this.firstNames.add(event.firstName);
        this.lastNames.add(event.lastName);
        this.phoneNumbers.add(event.phoneNumber);
        this.version += 1;
        break;

      case "Contacted":
      case "FollowupSet":
      case "OrderSubmitted":
      case "PaymentConfirmed":
        this.version += 1;
        break;

      default:
        const _exhaustiveCheck: never = event;
        throw new Error(
          `Unhandled event type: ${(_exhaustiveCheck as any).type}`
        );
    }
  }
}
