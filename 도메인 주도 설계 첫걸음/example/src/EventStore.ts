export interface IEventStore {
  fetch(instanceId: Guid): Event[];
  append(instanceId: Guid, events: Event[], expectedVersion: number): void;
}
