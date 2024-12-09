import { DiscountConditionType } from "./conditions/discount-condition.js";
import Customer from "./customer.js";
import Money from "./money.js";
import { MovieType } from "./movie.js";
import Reservation from "./reservation.js";
import Screening from "./screening.js";

/**
 * 여러개의 데이터 클래스들을 조합해서 영화 예매 절차를 구현하는 클래스
 */
export default class ReservationAgency {
  reserve(screening: Screening, customer: Customer, audienceCount: number) {
    const fee = screening.calculateFee(audienceCount);
    return new Reservation(customer, screening, fee, audienceCount);
  }
}
