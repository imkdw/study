import { Grade } from "./grade.js";
import { Lecture } from "./lecture.js";

export class GradeLecture extends Lecture {
  private grades: Grade[] = [];

  constructor(name: string, pass: number, grades: Grade[], scores: number[]) {
    super(name, pass, scores);
    this.grades = grades;
  }

  evaludate(): string {
    return super.evaludate() + ", " + this.gradeStatistics();
  }

  private gradeStatistics(): string {
    return this.grades.map((grade) => this.format(grade)).join(", ");
  }

  private format(grade: Grade): string {
    return `${grade.getName()}:${this.gradeCount(grade)}`;
  }

  private gradeCount(grade: Grade): number {
    return this.scores.filter((score) => grade.include(score)).length;
  }
}
