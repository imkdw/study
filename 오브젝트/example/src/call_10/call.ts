import Duration from "./duration";
import LocalTime from "./local-time";

/**
 * 개별 통화 기간을 저장하는 객체
 */
export default class Call {
  private from: LocalTime;
  private to: LocalTime;

  constructor(from: LocalTime, to: LocalTime) {
    this.from = from;
    this.to = to;
  }

  getDuration(): Duration {
    return Duration.between(this.from, this.to);
  }

  getFrom() {
    return this.from;
  }

  getHour() {
    return this.from.getHour();
  }
}
