export class DiscountCalulateService {
  calculateDiscountAmounts(orderLines: OrderLine[], coupons: Coupon[], grade: MemberGrade): Money {
    const couponDiscount = coupons.reduce(
      (acc, coupon) => acc.plus(this.calculateCouponDiscountAmount(coupon)),
      Money.ZERO
    );

    const membershipDiscount = this.calculateMembershipDiscountAmount(grade);

    return couponDiscount.plus(membershipDiscount);
  }

  private calculateCouponDiscountAmount(coupons: Coupon) {
    // ...
  }

  private calculateMembershipDiscountAmount(grade: MemberGrade) {
    // ...
  }
}
