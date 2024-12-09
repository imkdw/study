export interface DiscountCondition {
  isSatisfiedBy(screening: Screening): boolean;
}
