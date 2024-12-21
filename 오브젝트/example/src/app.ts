import { GradeLecture } from "./lecture/grade-lecture.js";
import { Grade } from "./lecture/grade.js";
import { Lecture } from "./lecture/lecture.js";
import { Professor } from "./lecture/professor.js";

const professor = new Professor(
  "다익스트라",
  new GradeLecture(
    "Algorithm",
    70,
    [
      new Grade("A+", 100, 90),
      new Grade("A0", 89, 80),
      new Grade("B+", 79, 70),
    ],
    [81, 95, 75, 70, 45]
  )
);

// [다익스트라] Pass: 4, Fail: 1, A+:1, A0:1, B+:2 - Avg: 73.2
console.log(professor.complieStatistics());
