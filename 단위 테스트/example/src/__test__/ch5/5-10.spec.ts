interface IEmailGategway {
  sendReceipt(email: string, productName: string, quantity: number): void;
}

it("successful_purchase", () => {
  const mock: jest.Mocked<IEmailGategway> = {
    sendReceipt: jest.fn(),
  };
  const sut = new CustomerController(mock);

  const isSuccess = sut.purchase(1, 2, 3);

  expect(isSuccess).toBe(true);

  /**
   * 시스템에서 구매에 대한 이메일 발송여부 검증
   */
  expect(mock.sendReceipt).toHaveBeenCalledWith([
    "customer@email.com",
    "Shampoo",
    5,
  ]);
});
