import { DayOfWeek } from "../movie_ddd/conditions/period-condition.js";
import LocalTime from "../movie_ddd/local-time.js";
import Duration from "../movie_rdd/duration.js";

/**
 * 반복 일정
 */
export default class RecurringSchedule {
  private subject: string;
  private dayofWeek: DayOfWeek;
  private from: LocalTime;
  private duration: Duration;

  constructor(
    subject: string,
    dayofWeek: DayOfWeek,
    from: LocalTime,
    duration: Duration
  ) {
    this.subject = subject;
    this.dayofWeek = dayofWeek;
    this.from = from;
    this.duration = duration;
  }

  // getters..
}

/**
 * 매주 수요일 10:30부터 30분간 진행되는 반복 일정
 */
const schedule = new RecurringSchedule(
  "회의",
  DayOfWeek.WEDNESDAY,
  LocalTime.of(10, 30),
  Duration.ofMinutes(30)
);
