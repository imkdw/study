import Audience from "./authdience.js";
import Ticket from "./ticket.js";

export default class TicketOffice {
  private amount: number;
  private tickets: Ticket[] = [];

  constructor(amount: number, ...tickets: Ticket[]) {
    this.amount = amount;
    this.tickets = tickets;
  }

  sellTicketTo(audience: Audience): void {
    this.plusAmount(audience.buy(this.getTicket()));
  }

  private getTicket(): Ticket {
    return this.tickets.shift()!;
  }

  private plusAmount(amount: number): void {
    this.amount += amount;
  }
}
