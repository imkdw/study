@Controller("events")
export class EventHandlerController {
  constructor(private readonly eventStoreHandler: EventStoreHandler) {}

  @Get()
  async getEvents(@Query("offset") offset: number, @Query("limit") limit: number): Promise<Event[]> {
    return this.eventStoreHandler.getEvents();
  }
}
