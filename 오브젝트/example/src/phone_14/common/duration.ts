import LocalTime from "./local-time";

export default class Duration {
  private milliseconds: number;

  private constructor(milliseconds: number) {
    this.milliseconds = milliseconds;
  }

  static ofSeconds(seconds: number): Duration {
    return new Duration(seconds * 1000);
  }

  static ofMinutes(minutes: number): Duration {
    return new Duration(minutes * 60 * 1000);
  }

  static ofHours(hours: number): Duration {
    return new Duration(hours * 60 * 60 * 1000);
  }

  toMillis(): number {
    return this.milliseconds;
  }

  getMinutes(): number {
    return this.milliseconds / 60000;
  }

  getSeconds(): number {
    return this.milliseconds / 1000;
  }

  static between(from: LocalTime, to: LocalTime) {
    return new Duration(to.toMillis() - from.toMillis());
  }
}
