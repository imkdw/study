export class EventEntry {
  private id: number;
  private type: string;
  private contentType: string;
  private payload: string;
  private timestamp: number;

  constructor(id: number, type: string, contentType: string, payload: string) {
    this.id = id;
    this.type = type;
    this.contentType = contentType;
    this.payload = payload;
    this.timestamp = new Date().getTime();
  }

  // getters
}
