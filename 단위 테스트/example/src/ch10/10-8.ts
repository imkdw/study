describe("UserController", () => {
  const createUser = async (
    email: string,
    userType: UserType,
    isEmailConfirmed: boolean
  ) => {
    const user = new User(0, email, type, isEmailConfirmed);
    const repository = new UserRepository();
    repository.save(user);
    return user;
  };

  it("some_user_test", () => {
    // Given
    const user = await createUser();

    // When
    // ...

    // Then
    // ...
  });
});
