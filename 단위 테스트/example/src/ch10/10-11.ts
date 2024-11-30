class UserController {
  constructor(private messageBus: IMessageBus, private logger: IDomainLogger) {}

  // 컨트롤러 메서드들...
  changeEmail(userId: string, newEmail: string): string {
    // 구현...
    return "result";
  }
}

// 테스트 헬퍼 함수
const execute = (
  func: (controller: UserController) => string,
  messageBus: IMessageBus,
  logger: IDomainLogger
): string => {
  const controller = new UserController(messageBus, logger);
  return func(controller);
};

// 테스트 코드
describe("UserController", () => {
  let messageBus: jest.Mocked<IMessageBus>;
  let logger: jest.Mocked<IDomainLogger>;

  beforeEach(() => {
    messageBus = {
      publish: jest.fn(),
    } as jest.Mocked<IMessageBus>;

    logger = {
      log: jest.fn(),
    } as jest.Mocked<IDomainLogger>;
  });

  it("should change email", () => {
    const result = execute(
      (controller) => controller.changeEmail("userId123", "new@gmail.com"),
      messageBus,
      logger
    );

    // 결과 검증
    expect(result).toBe("expected result");
    // 필요한 경우 mock 호출 검증
    expect(messageBus.publish).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalled();
  });
});
