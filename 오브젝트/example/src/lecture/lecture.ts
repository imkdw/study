export class Lecture {
  private pass: number;
  private title: string;
  protected scores: number[] = [];

  constructor(title: string, pass: number, scores: number[]) {
    this.scores = scores;
    this.pass = pass;
    this.title = title;
  }

  average(): number {
    return this.scores.reduce((a, b) => a + b, 0) / this.scores.length;
  }

  getScores(): number[] {
    return this.scores;
  }

  evaludate() {
    return `Pass: ${this.passCount()}, Fail: ${this.failCount()}`;
  }

  private passCount(): number {
    return this.scores.filter((score) => score >= this.pass).length;
  }

  private failCount(): number {
    return this.scores.length - this.passCount();
  }
}
