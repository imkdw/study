describe("CustomerTests", () => {
  let _store: Store;
  let _sut: Customer;

  // 각 테스트 실행 이전에 호출됨
  beforeEach(() => {
    _store = new Store();
    _store.addInventory(Product.Shampoo, 5);
    _sut = new Customer();
  });

  it("purchase_succeeds_when_enough_inventory", () => {
    const success = _sut.purchase(_store, Product.Shampoo, 5);
    expect(success).toBe(true);
    expect(_store.getInventory(Product.Shampoo)).toBe(5);
  });

  it("purchase_fails_when_not_enough_inventory", () => {
    const success = _sut.purchase(_store, Product.Shampoo, 15);
    expect(success).toBe(false);
    expect(_store.getInventory(Product.Shampoo)).toBe(10);
  });
});
