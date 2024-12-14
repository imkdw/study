import Duration from "./duration.js";
import Money from "./money.js";
import { Phone } from "./phone.js";
import { RateDiscountablePolicy } from "./rate-discountable-policy.js";
import { RegularPolicy } from "./regular-policy.js";
import { TaxablePolicy } from "./taxable-policy.js";

/**
 * 기본 요금제에 세금 정책을 조합
 */
const phone1 = new Phone(
  new TaxablePolicy(
    new RegularPolicy(Money.wons(1000), Duration.ofSeconds(60)),
    0.05
  )
);

/**
 * 일반 요금제 + 기본 요금 할인 정책 + 세금 정책
 */
const phone2 = new Phone(
  new TaxablePolicy(
    new RateDiscountablePolicy(
      new RegularPolicy(Money.wons(1000), Duration.ofSeconds(60)),
      Money.wons(1000)
    ),
    0.05
  )
);

/**
 * 일반 요금제 + 세금정책 + 기본 요금 할인 정책(순서변경한 버전)
 */
const phone3 = new Phone(
  new TaxablePolicy(
    new RateDiscountablePolicy(
      new RegularPolicy(Money.wons(1000), Duration.ofSeconds(60)),
      Money.wons(1000)
    ),
    0.05
  )
);
