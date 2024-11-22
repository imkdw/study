describe("CustomerTests", () => {
  it("purchase_succeeds_when_enough_inventory", () => {
    const store = createStoreWithInventory(Product.Shampoo, 5);
    const sut = createCustomer();

    const success = sut.purchase(store, Product.Shampoo, 5);

    expect(success).toBe(true);
    expect(store.getInventory(Product.Shampoo)).toBe(5);
  });

  it("purchase_fails_when_not_enough_inventory", () => {
    const store = createStoreWithInventory(Product.Shampoo, 5);
    const sut = createCustomer();

    const success = sut.purchase(store, Product.Shampoo, 15);

    expect(success).toBe(false);
    expect(store.getInventory(Product.Shampoo)).toBe(10);
  });

  const createStoreWithInventory = (product: Product, quantity: number) => {
    const store = new Store();
    store.addInventory(product, quantity);
    return store;
  };

  const createCustomer = () => {
    return new Customer();
  };
});
