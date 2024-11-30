export class UserExtensoins {
  static shouldExist(user: User): User {
    expect(user).not.toBeNull();
    return user;
  }

  static withEmail(user: User, email: string): User {
    expect(user.email).toBe(email);
    return user;
  }
}

it("some_user_test", () => {
  // 준비
  // ...

  // 실행
  // ...

  // 검증
  const userFromDb = QueryUser(user.userId);
  userFromDb.shouldExist().withEmail("some@email.com");
});
