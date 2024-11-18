const Product = {
  Shampoo: "Shampoo",
  Book: "Book",
};

it("purchage_succeeds_when_enough_inventory", () => {
  // 준비
  const storeMock = {
    hasEnoughInventory: jest.fn().mockReturnValue(true),
    removeInventory: jest.fn(),
  };
  const customer = new Customer();

  // 실행
  const success = customer.purchase(storeMock, Product.Shampoo, 5);

  // 검증
  expect(success).toBe(true);
  expect(storeMock.hasEnoughInventory).toHaveBeenCalledWith(Product.Shampoo, 5);
});

it("purchase_fails_when_not_enough_inventory", () => {
  // 준비
  const storeMock = {
    hasEnoughInventory: jest.fn().mockReturnValue(false),
    removeInventory: jest.fn(),
  };
  const customer = new Customer();

  // 실행
  const success = customer.purchase(storeMock, Product.Shampoo, 15);

  // 검증
  expect(success).toBe(false);
  expect(storeMock.removeInventory).toHaveBeenCalledTimes(0);
});
