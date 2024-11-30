it("some_user_test", () => {
  // 준비
  // ...

  // 실행
  // ...

  // 검증
  const userFromDb = QueryUser(user.userId);
  expect(userFromDb.email).toBe("some@email.com");

  const companyFromDb = QueryCompany(company.id);
  expect(companyFromDb.name).toBe("some company");
});
