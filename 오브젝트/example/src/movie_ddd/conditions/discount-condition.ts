import LocalTime from "../local-time.js";
import { DayOfWeek } from "./period-condition.js";

export const DiscountConditionType = {
  SEQUENCE: "SEQUENCE", // 순번 조건
  PERIOD: "PERIOD", // 기간 조건
};

export type DiscountConditionType =
  (typeof DiscountConditionType)[keyof typeof DiscountConditionType];

export default class DiscountCondition {
  private type: DiscountConditionType;
  private sequence: number;

  private dayOfWeek: DayOfWeek;
  private startTime: LocalTime;
  private endTime: LocalTime;

  constructor(
    type: DiscountConditionType,
    sequence: number,
    dayOfWeek: DayOfWeek,
    startTime: LocalTime,
    endTime: LocalTime
  ) {
    this.type = type;
    this.sequence = sequence;
    this.dayOfWeek = dayOfWeek;
    this.startTime = startTime;
    this.endTime = endTime;
  }

  // getters...
  getType(): DiscountConditionType {
    return this.type;
  }

  getDayOfWeek(): DayOfWeek {
    return this.dayOfWeek;
  }

  getStartTime(): LocalTime {
    return this.startTime;
  }

  getEndTime(): LocalTime {
    return this.endTime;
  }

  getSequence(): number {
    return this.sequence;
  }

  // setters...

  isDiscountable(
    condition: number | { dayOfWeek: DayOfWeek; time: LocalTime }
  ): boolean {
    if (typeof condition === "number") {
      return this.isDiscountableBySequence(condition);
    } else {
      return this.isDiscountableByPeriod(condition.dayOfWeek, condition.time);
    }
  }

  private isDiscountableBySequence(sequence: number): boolean {
    if (this.type !== DiscountConditionType.SEQUENCE) {
      return false;
    }
    return this.sequence === sequence;
  }

  private isDiscountableByPeriod(
    dayOfWeek: DayOfWeek,
    time: LocalTime
  ): boolean {
    if (this.type !== DiscountConditionType.PERIOD) {
      return false;
    }
    return (
      this.dayOfWeek === dayOfWeek &&
      this.startTime.compareTo(time) <= 0 &&
      this.endTime.compareTo(time) >= 0
    );
  }
}
