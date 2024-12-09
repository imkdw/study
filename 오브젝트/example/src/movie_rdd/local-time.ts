export default class LocalTime {
  private hours: number;
  private minutes: number;
  private milliseconds: number;

  private constructor(hours: number, minutes: number) {
    this.hours = hours;
    this.minutes = minutes;
    this.milliseconds = (hours * 60 + minutes) * 60 * 1000;
  }

  static of(hours: number, minutes: number): LocalTime {
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error("Invalid time");
    }
    return new LocalTime(hours, minutes);
  }

  getTime(): number {
    return this.milliseconds;
  }

  compareTo(other: LocalTime): number {
    return this.milliseconds - other.milliseconds;
  }
}
