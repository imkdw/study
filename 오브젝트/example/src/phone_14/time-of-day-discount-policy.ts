import LocalTime from "../movie_rdd/local-time";
import { BasicRatePolicy } from "./basic-rate-policy";
import { Call } from "./call";
import Duration from "./common/duration";
import Money from "./common/money";

export class TimeOfDayDiscountPolicy extends BasicRatePolicy {
  private starts: LocalTime[] = [];
  private ends: LocalTime[] = [];
  private durations: Duration[] = [];
  private amounts: Money[] = [];

  constructor(starts: LocalTime[], ends: LocalTime[], durations: Duration[], amounts: Money[]) {
    super();
    this.starts = starts;
    this.ends = ends;
    this.durations = durations;
    this.amounts = amounts;
  }

  protected calculateCallFee(call: Call): Money {
    let result = Money.ZERO;

    for (const interval of call.)
  }
}
