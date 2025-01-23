import { DiscountCalulateService } from "./DiscountCalculationService.js";

export class Order {
  // ...

  calculateAmounts(discountCalculateService: DiscountCalulateService, grade: MemberGrade) {
    const totalAmounts = this.getTotalAmounts();

    const discountAmounts = discountCalculateService.calculateDiscountAmounts(this.orderLines, this.coupons, grade);

    this.paymentAmounts = totalAmounts.minus(discountAmounts);
  }
}
