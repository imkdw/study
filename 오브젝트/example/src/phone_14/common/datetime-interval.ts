import Duration from "./duration";
import LocalTime from "./local-time";

export class DateTimeInterval {
  private from: LocalTime;
  private to: LocalTime;

  private constructor(from: LocalTime, to: LocalTime) {
    this.from = from;
    this.to = to;
  }

  static of(from: LocalTime, to: LocalTime): DateTimeInterval {
    return new DateTimeInterval(from, to);
  }

  static toMidnight(from: LocalTime): DateTimeInterval {
    return new DateTimeInterval(from, LocalTime.of(23, 59, 59, 999));
  }

  static fromMidnight(to: LocalTime): DateTimeInterval {
    return new DateTimeInterval(LocalTime.of(0, 0, 0, 0), to);
  }

  static during(from: LocalTime, to: LocalTime): DateTimeInterval {
    return new DateTimeInterval(from, to);
  }

  duration(): Duration {
    return Duration.between(this.from, this.to);
  }

  getFrom(): LocalTime {
    return this.from;
  }

  getTo(): LocalTime {
    return this.to;
  }
}
