it("changing_email_from_corporate_to_non_corporate", () => {
  const company = new Company("mycorp.com", 1);
  const sut = new User(1, "user@mycorp.com", UserType.EMPLOYEE, false);

  sut.changeEmail("new@gmail.com", company);

  expect(company.numberOfEmployees).toBe(0);
  expect(sut.email).toBe("new@gmail.com");
  expect(sut.type).toBe(UserType.CUSTOMER);
  expect(sut.emailChangedEvents).toHaveLength(1);
  expect(sut.emailChangedEvents[0]).toEqual(new EmailChangedEvent(1, "new@gmail.com")
});
