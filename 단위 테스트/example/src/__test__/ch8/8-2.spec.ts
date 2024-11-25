it("changing_email_from_corporate_to_non_corporate", () => {
  // 준비
  const db = new Database();
  const user = createUser("user@mycorp.com", UserType.EMPLOYEE, db); // 유저 생성 헬퍼메소드
  createCompany("mycorp.com", 1, db); // 회사 생성 헬퍼메소드

  const messageBusMock: jest.Mocked<IMessageBus> = {};
  const sut = new UserController(db, messageBusMock);

  // 실행
  const result = sut.changeEmail(user.userId, "new@gmail.com");

  // 검증
  expect(result).toBe("ok");

  // 유저 상태 검증
  const userData = db.getUserById(user.userId);
  const userFromDb = UserFactory.create(userData);
  expect("new@gmail.com").toBe(userFromDb.email);
  expect(userFromDb.type).toBe(UserType.CUSTOMER);

  // 회사 상태 검증
  const companyData = db.getCompanyById(user.companyId);
  const companyFromDb = CompanyFactory.create(companyData);
  expect(companyFromDb.employeeCount).toBe(0);

  // 목 상호작용 확인
  expect(messageBusMock.sendMessage).toHaveBeenCalledWith(user.userId, "new@gmail.com");
  expect(messageBusMock.sendMessage).toHaveBeenCalledTimes(1);
});
