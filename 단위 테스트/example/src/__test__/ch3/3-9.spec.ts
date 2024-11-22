let db: Database;

describe("SomeIntegrationTests", () => {
  beforeAll(async () => {
    db = new Database();
    await db.connect();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.clear();
  });

  it("some_test", () => {
    // 실행
  });
});
