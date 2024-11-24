it("change_email_from_non_corporate_to_corporate", () => {
  const company = new Company("mycorp.com", 1);
  const sut = new User(1, "user@gmail.com", UserType.CUSTOMER);

  sut.changeEmail("new@mycorp.com", company);

  expect(company.numberOfEmployees).toBe(2);
  expect(sut.email).toBe("new@mycorp.com");
  expect(sut.type).toBe(UserType.EMPLOYEE);
});

it.each([
  ["mycorp.com", "email@mycorp.com", true],
  ["mycorp.com", "email@gmail.com", false],
])(
  "differentiates_a_corporate_email_from_non_corporate",
  (domain, email, expectedResult) => {
    const sut = new Company(domain, 0);

    const isEmailCorporate = sut.isEmailCorporate(email);

    expect(isEmailCorporate).toBe(expectedResult);
  }
);
