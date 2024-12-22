export class TicketAPI {
  private readonly ticketRepository: TicketRepository;

  constructor(ticketRepository: TicketRepository) {
    this.ticketRepository = ticketRepository;
  }

  requestEscalation(id: TicketId, reason: EscalationReason): void {
    const events = this.ticketRepository.loadEvents(id);
    const ticket = new Ticket(events);
    const originalVersion = ticket.version;
    const cmd = new RequestEscalation(reason);
    ticket.execute(cmd);
    this.ticketRepository.commitChanges(ticket, originalVersion);
  }
}
