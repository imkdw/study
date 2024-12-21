export class Grade {
  private name: string;
  private upper: number;
  private lower: number;

  constructor(name: string, upper: number, lower: number) {
    this.name = name;
    this.upper = upper;
    this.lower = lower;
  }

  getName(): string {
    return this.name;
  }

  isName(name: string): boolean {
    return this.name === name;
  }

  include(score: number): boolean {
    return score >= this.lower && score <= this.upper;
  }
}
