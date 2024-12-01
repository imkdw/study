import Bag from "./bag.js";
import Ticket from "./ticket.js";

export default class Audience {
  private bag: Bag;

  constructor(bag: Bag) {
    this.bag = bag;
  }

  buy(ticket: Ticket): number {
    return this.bag.hold(ticket);
  }
}
