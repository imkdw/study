class Order {
  products: Product[] = [];

  addProduct(product: Product) {
    this.products.push(product);
  }
}

it("adding_a_product_to_an_order", () => {
  const product = new Product("Hasn Wash");
  const sut = new Order();

  sut.addProduct(product);

  expect(sut.products).toHaveLength(1);
  expect(sut.products[0]).toBe(product);
});
