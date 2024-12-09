import LocalTime from "../movie_ddd/local-time.js";
import Duration from "../movie_rdd/duration.js";
import RecurringSchedule from "./recurring-schedule.js";

/**
 * 특정 일자에 실제로 발생하는 사건을 의미함
 * 2019.05.08 10:30 ~ 11:00까지 회의가 잡혀있다면 이 회의가 이벤트가됨
 * 반복일정은 일주일 단위로 돌아오는 특정 시간 간격에 발생하는 사건 전체를 포괄적으로 지칭하는 용어다
 *
 */
export default class Event {
  private subject: string;
  private from: LocalTime;
  private duration: Duration;

  constructor(subject: string, from: LocalTime, duration: Duration) {
    this.subject = subject;
    this.from = from;
    this.duration = duration;
  }

  isSatiesfied(schedule: RecurringSchedule): boolean {
    if (
      this.from.getDayOfWeek() != schedule.getDayOfWeek() ||
      this.from.toLocalTime() !== schedule.getFrom() ||
      this.duration !== schedule.getDuration()
    ) {
      return false;
    }

    return true;
  }

  reschedule(schedule: RecurringSchedule) {
    this.from = LocalTime.of(
      this.from.toLocalTime().plusDays(daysDistance(schedule)),
      schedule.getFrom()
    );
    this.duration = schedule.getDuration();
  }

  private daysDistance(schedule: RecurringSchedule): number {
    return (schedule.getDayOfWeek() - this.from.getDayOfWeek()) % 7;
  }
}

/**
 * 2019.05.08 10:30 부터 30분간 발생하는 사건
 */
const event = new Event(
  "회의",
  new LocalTime(2019, 5, 8, 10, 30),
  Duration.ofMinutes(30)
);
