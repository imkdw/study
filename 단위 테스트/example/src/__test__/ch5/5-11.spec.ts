it("purchase_succeeds_when_enough_inventory", () => {
  const storeMock: jest.Mocked<IStore> = {
    hasEnoughInventory: jest
      .fn()
      .mockImplementation((product: Product, quantity: number) => {
        if (product.name === "Shampoo" && quantity === 5) {
          return true;
        }

        return false;
      }),
  };

  const customer = new Customer();

  const success = customer.purchase(storeMock, Product.Shampoo, 5);

  expect(success).toBe(true);
  expect(storeMock.removeInventory).toHaveBeenCalledWith(Product.Shampoo, 5);

  /**
   * 실제 유용한 메소드는 customer.purchase(), storeMock.hasEnoughInventory(), storeMock.removeInventory() 이다.
   * 하지만 removeInventory() 메소드는 고객의 중간단계, 즉 세부 구현 사항이므로 테스트와 결합되어버린다
   */
  expect(storeMock.removeInventory).toHaveBeenCalledTimes(1);
});
