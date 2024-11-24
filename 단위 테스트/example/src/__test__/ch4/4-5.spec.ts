class User {
  constructor(private name: string) {}

  getName(): string {
    return this.name;
  }
}

it("User", () => {
  const name = "name";

  const sut = new User("name");

  expect(sut.getName()).toBe(name);
});
