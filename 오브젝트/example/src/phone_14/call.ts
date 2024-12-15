import { DateTimeInterval } from "./common/datetime-interval";
import Duration from "./common/duration";
import LocalTime from "./common/local-time";

export class Call {
  private interval: DateTimeInterval;

  constructor(from: LocalTime, to: LocalTime) {
    this.interval = DateTimeInterval.of(from, to);
  }

  getDuration(): Duration {
    return this.interval.duration();
  }

  getFrom(): LocalTime {
    return this.interval.getFrom();
  }

  getTo(): LocalTime {
    return this.interval.getTo();
  }

  getInterval(): DateTimeInterval {
    return this.interval;
  }

  splitByDay() {
    return this.interval.splitByDay();
  }
}
