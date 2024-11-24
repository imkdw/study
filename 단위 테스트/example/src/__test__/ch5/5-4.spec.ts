it("purchase_fails_when_not_enough_inventory", () => {
  /**
   * 스텁을 통해서 기존에 정의된 응답을 설정함
   */
  const storeMock: jest.Mocked<IStore> = {
    hasEnoughInventory: jest
      .fn()
      .mockImplementation((product: typeof Product, quanity: number) => false),
  };
  const sut = new Customer();

  const success = sut.purchase(storeMock, Product.Shampoo, 5);

  expect(success).toBe(false);

  /**
   * 목을 통해서 sut에서 수행한 호출을 검사함
   */
  expect(storeMock.removeInventory(Product.Shampoo, 5)).toHaveBeenCalledTimes(
    0
  );
});
