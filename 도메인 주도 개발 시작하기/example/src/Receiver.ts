export class Receiver {
  private name: string;
  private phoneNumber: string;

  constructor(name: string, phoneNumber: string) {
    this.name = name;
    this.phoneNumber = phoneNumber;
  }

  getName(): string {
    return this.name;
  }

  getPhoneNumber(): string {
    return this.phoneNumber;
  }
}
