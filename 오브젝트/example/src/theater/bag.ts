import Invitation from "./invitation.js";
import Ticket from "./ticket.js";

/**
 * 관람객이 소지품을 보관할 가방
 *
 * 1. 이벤트에 당첨되지 않은 관람객의 가방에는 초대장이 들어있지 않을것
 * 2. 이벤트에 당첨된 관람객의 가방에는 현금과 초대장이 들어있음
 */
export default class Bag {
  private amount: number;
  private invitation: Invitation | undefined;
  private ticket: Ticket | null = null;

  constructor(amount: number, invitation?: Invitation) {
    this.amount = amount;
    this.invitation = invitation;
  }

  hold(ticket: Ticket): number {
    if (this.hasInvitation()) {
      this.setTicket(ticket);
      return 0;
    } else {
      this.setTicket(ticket);
      this.minusAmount(ticket.getFee());
      return ticket.getFee();
    }
  }

  private hasInvitation(): boolean {
    return this.invitation !== undefined;
  }

  private setTicket(ticket: Ticket): void {
    this.ticket = ticket;
  }

  private minusAmount(amount: number): void {
    this.amount -= amount;
  }
}
