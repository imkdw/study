class PriceEngine {
  calculateDiscount(products: Product[]) {
    const discount = products.length * 0.01;
    return Math.min(discount, 0.02);
  }
}

it("discount_of_two_products", () => {
  const product1 = new Product("Hand Wash");
  const product2 = new Product("Shampoo");
  const sut = new PriceEngine();

  const discount = sut.calculateDiscount([product1, product2]);

  expect(discount).toBe(0.02);
});
