import Call from "./call";
import Duration from "./duration";
import LocalTime from "./local-time";
import Money from "./money";
import Phone from "./regular-phone";

const phone = new Phone(Money.wons(5), Duration.ofSeconds(10));
phone.call(
  new Call(LocalTime.of(2020, 1, 1, 10, 0), LocalTime.of(2020, 1, 1, 11, 0))
);
phone.call(
  new Call(LocalTime.of(2020, 1, 1, 12, 0), LocalTime.of(2020, 1, 1, 13, 0))
);

phone.calculateFee();
