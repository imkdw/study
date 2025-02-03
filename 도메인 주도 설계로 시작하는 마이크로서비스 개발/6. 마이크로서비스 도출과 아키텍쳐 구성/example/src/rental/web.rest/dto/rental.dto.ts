export class RentalDTO {
  constructor(id: string) {
    this.id = id;
  }

  private id: string;

  getId() {
    return this.id;
  }
}
