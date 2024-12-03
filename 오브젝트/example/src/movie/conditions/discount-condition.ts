import Screening from "../screening";

export default interface DiscountCondition {
  isSatisfiedBy(screening: Screening): boolean;
}
