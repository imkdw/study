class UserRepository {
  private lastExecutedSqlStatement: string;

  getById(id: number) {
    // ...
  }

  getLastExecutedSqlStatement() {
    return this.lastExecutedSqlStatement;
  }

  setLastExecutedSqlStatement(sql: string) {
    this.lastExecutedSqlStatement = sql;
  }
}

it("getById_executes_corrent_SQL_code", () => {
  const sut = new UserRepository();

  const user = sut.getById(5);

  expect(sut.getLastExecutedSqlStatement()).toBe(
    "SELECT * dbo.[User] WHERE UserID = 5"
  );

  expect(sut).toBeInstanceOf(UserRepository);
});
