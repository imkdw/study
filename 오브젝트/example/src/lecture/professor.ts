import { Lecture } from "./lecture.js";

export class Professor {
  private name: string;
  private lecture: Lecture;

  constructor(name: string, lecture: Lecture) {
    this.name = name;
    this.lecture = lecture;
  }

  complieStatistics(): string {
    return `[${
      this.name
    }] ${this.lecture.evaludate()} - Avg: ${this.lecture.average()}`;
  }
}
