import { DiscountCondition } from "./discount-condition.js";

export default class PerioidCondition implements DiscountCondition {
  private dayOfWeek: DayOfWeek;
  private startTime: LocalTime;
  private endTime: LocalTime;

  constructor(dayOfWeek: DayOfWeek, startTime: LocalTime, endTime: LocalTime) {
    this.dayOfWeek = dayOfWeek;
    this.startTime = startTime;
    this.endTime = endTime;
  }

  isSatisfiedBy(screening: Screening): boolean {
    return (
      screening.getWhenScreened().getDayOfWeek() === this.dayOfWeek &&
      this.startTime.getTime() <= screening.getWhenScreened().getTime() &&
      this.endTime.getTime() >= screening.getWhenScreened().getTime()
    );
  }
}
