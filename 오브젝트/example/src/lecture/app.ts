import { Lecture } from "./lecture.js";
import { Professor } from "./professor.js";

const professor = new Professor(
  "다익스트라",
  new Lecture("Algorithm", 70, [81, 95, 75, 70, 45])
);

console.log(professor.complieStatistics()); // [다익스트라] Pass: 4, Fail: 1 - Avg: 73.2
