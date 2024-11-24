interface IDatabase {
  getNumberOfUsers(): number;
}

it("creating_a_report", () => {
  const stub: jest.Mocked<IDatabase> = {
    getNumberOfUsers: jest.fn().mockReturnValue(10),
  };
  const sut = new ReportGenerator(stub);

  const report = sut.createReport();

  expect(report.numberOfUsers).toBe(10);

  /**
   * 안티패턴 : 스텁으로 관련 의존성 간 상호작용을 검증
   */
  expect(stub.getNumberOfUsers).toHaveBeenCalledTimes(1);
});
