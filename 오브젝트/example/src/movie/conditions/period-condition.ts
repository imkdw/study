import LocalTime from "../local-time";
import Screening from "../screening";
import DiscountCondition from "./discount-condition";

export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

/**
 * 상영 시간이 특정 기간안에 포함되는지 여부를 검사함
 *
 */
export class PeriodCondition implements DiscountCondition {
  private dayOfWeek: DayOfWeek;
  private startTime: LocalTime;
  private endTime: LocalTime;

  constructor(dayOfWeek: DayOfWeek, startTime: LocalTime, endTime: LocalTime) {
    this.dayOfWeek = dayOfWeek;
    this.startTime = startTime;
    this.endTime = endTime;
  }

  isSatisfiedBy(screening: Screening): boolean {
    const screeningTime = screening.getStartTime();
    const screeningDayOfWeek = screeningTime.getDay();

    return (
      screeningDayOfWeek === this.dayOfWeek &&
      this.startTime.getTime() <= screeningTime.getTime() &&
      this.endTime.getTime() >= screeningTime.getTime()
    );
  }
}
