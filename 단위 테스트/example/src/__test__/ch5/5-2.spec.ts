interface IDatabase {
  getNumberOfUsers(): number;
}

it("creating_a_report", () => {
  /**
   * SUT에 입력 데이터를 제공하는 호출을 모방함
   *
   * IDatabase 인터페이스에 대해서 getNumberOfUsers 메소드가 10을 반환한다고 미리 설정함
   */
  const stub: jest.Mocked<IDatabase> = {
    getNumberOfUsers: jest.fn().mockReturnValue(10),
  };
  const sut = new ReportGenerator(stub);

  const report = sut.createReport();

  expect(report.numberOfUsers).toBe(10);
});
