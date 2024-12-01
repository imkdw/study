import Audience from "./authdience.js";
import TicketSeller from "./ticket-seller.js";

export default class Theater {
  private ticketSeller: TicketSeller;

  constructor(ticketSeller: TicketSeller) {
    this.ticketSeller = ticketSeller;
  }

  enter(audience: Audience): void {
    this.ticketSeller.sellTo(audience);
  }
}
