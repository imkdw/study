class BookingProcessManager {
  private events: IDomainEvent[] = [];
  private id: BookingId;
  private destination: Destination;
  private parameters: TripDefinition;
  private traveler: EmployeeId;
  private route: Route;
  private rejectedRoutes: Route[] = [];

  constructor(private readonly routing: IRoutingService) {}

  initialize(
    destination: Destination,
    parameters: TripDefinition,
    traveler: EmployeeId
  ): void {
    this.destination = destination;
    this.parameters = parameters;
    this.traveler = traveler;
    this.route = this.routing.calculate(destination, parameters);

    const routeGenerated = new RouteGeneratedEvent(this.id, this.route);

    const commandIssuedEvent = new CommandIssuedEvent(
      new RequestEmployeeApproval(this.traveler, this.route)
    );

    this.events.push(routeGenerated);
    this.events.push(commandIssuedEvent);
  }

  process(event: RouteConfirmed): void;
  process(event: RouteRejected): void;
  process(event: ReroutingConfirmed): void;
  process(event: FlightBooked): void;
  process(
    event: RouteConfirmed | RouteRejected | ReroutingConfirmed | FlightBooked
  ): void {
    if (event instanceof RouteConfirmed) {
      this.processRouteConfirmed(event);
    } else if (event instanceof RouteRejected) {
      this.processRouteRejected(event);
    } else if (event instanceof ReroutingConfirmed) {
      this.processReroutingConfirmed(event);
    } else if (event instanceof FlightBooked) {
      this.processFlightBooked(event);
    }
  }

  private processRouteConfirmed(confirmed: RouteConfirmed): void {
    const commandIssuedEvent = new CommandIssuedEvent(
      new BookFlights(this.route, this.parameters)
    );

    this.events.push(confirmed);
    this.events.push(commandIssuedEvent);
  }

  private processRouteRejected(rejected: RouteRejected): void {
    const commandIssuedEvent = new CommandIssuedEvent(
      new RequestRerouting(this.traveler, this.route)
    );

    this.events.push(rejected);
    this.events.push(commandIssuedEvent);
  }

  private processReroutingConfirmed(confirmed: ReroutingConfirmed): void {
    this.rejectedRoutes.push(this.route);
    this.route = this.routing.calculateAltRoute(
      this.destination,
      this.parameters,
      this.rejectedRoutes
    );

    const routeGenerated = new RouteGeneratedEvent(this.id, this.route);

    const commandIssuedEvent = new CommandIssuedEvent(
      new RequestEmployeeApproval(this.traveler, this.route)
    );

    this.events.push(confirmed);
    this.events.push(routeGenerated);
    this.events.push(commandIssuedEvent);
  }

  private processFlightBooked(booked: FlightBooked): void {
    const commandIssuedEvent = new CommandIssuedEvent(
      new BookHotel(this.destination, this.parameters)
    );

    this.events.push(booked);
    this.events.push(commandIssuedEvent);
  }
}
