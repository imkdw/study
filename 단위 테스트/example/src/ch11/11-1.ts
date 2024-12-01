class Order {
  private customer: Customer;
  private products: Product[];

  generateDescription(): string {
    return `
      구매자 정보 : ${this.customer.getName()}
      구매 상품 개수 : ${this.products.length}
      총 가격 : ${this.getPrice()}
    `
  }

  private getPrice(): number {
    const basePrice = ;
    const discounts = ;
    const taxes = ;
    return basePrice - discounts + taxes; 
  }
}