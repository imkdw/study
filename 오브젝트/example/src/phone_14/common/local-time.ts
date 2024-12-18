export default class LocalTime {
  private hours: number;
  private minutes: number;
  private seconds: number;
  private milliseconds: number;

  private constructor(hours: number, minutes: number, seconds: number, milliseconds: number) {
    this.hours = hours;
    this.minutes = minutes;
    this.seconds = seconds;
    this.milliseconds = milliseconds;
  }

  static of(hours: number, minutes: number, seconds: number, milliseconds: number): LocalTime {
    return new LocalTime(hours, minutes, seconds, milliseconds);
  }

  getTime(): number {
    return this.milliseconds;
  }

  getHour(): number {
    return this.hours;
  }

  compareTo(other: LocalTime): number {
    return this.milliseconds - other.milliseconds;
  }

  toMillis(): number {
    return this.milliseconds;
  }
}
