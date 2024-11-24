import { AuditManager, IFileSystem } from "../../6-9.js";

it("a_new_file_is_created_when_the_current_file_overflows", () => {
  const fileSystemMock: jest.Mocked<IFileSystem> = {
    getFiles: jest.fn().mockImplementation((audits) => {
      return ["audits/audit_1.txt", "audits/audit_2.txt"];
    }),
    readAllLines: jest.fn().mockImplementation((file) => {
      return ["Peter; 2019-12-12", "Jane: 2019-12-13", "Jack; 2019-12-14"];
    }),
    writeAllText: jest.fn(),
  };

  const sut = new AuditManager(3, "audits", fileSystemMock);

  sut.addRecord("Alice", new Date("2019-04-06T18:00:00"));

  expect(fileSystemMock.writeAllText).toHaveBeenCalledWith(
    "audits/audit_3.txt",
    "Alice;2019-04-06T18:00:00"
  );
});
