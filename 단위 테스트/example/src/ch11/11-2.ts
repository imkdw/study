class Order {
  private customer: Customer;
  private products: Product[];

  generateDescription(): string {
    const calc = new PriceCalculator();

    return `
      구매자 정보 : ${this.customer.getName()}
      구매 상품 개수 : ${this.products.length}
      총 가격 : ${calc.calculate(this.customer, this.products)}
    `
  }
}

class PriceCalculator {
  calculate(customer: Customer, products: Product[]): number {
    const basePrice = ;
    const discounts = ;
    const taxes = ;
    return basePrice - discounts + taxes;
  }
}