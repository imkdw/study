it("IsDeliveryValid_InvalidDate_ReturnsFalse", () => {
  const sut = new DeliveryService();
  const pastDate = new Date().setDate(new Date().getDate() - 1);
  const delivery = new Delivery(pastDate);

  const isValid = sut.IsDeliveryValid(delivery);

  expect(isValid).toBe(false);
});
