/**
 * 이벤트는 변경되지 않으므로 생성과 조회만 구현함
 */
interface EventStore {
  // 이벤트 추가
  save(event: object): void;

  // 이벤트 조회
  get(offset: number, limit: number): EventEntry[];
}

export class PrismaEventStore implements EventStore {
  save(event: object): void {
    // save event to database
  }

  get(offset: number, limit: number): EventEntry[] {
    // get events from database
  }
}
