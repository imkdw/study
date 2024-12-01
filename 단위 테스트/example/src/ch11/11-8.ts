class Logger {
  private isTestEnv: boolean;

  constructor(isTestEnv: boolean) {
    this.isTestEnv = isTestEnv;
  }

  log(text: string) {
    if (this.isTestEnv) {
      return;
    }

    // text logging...
  }
}

class Controller {
  someMethod(logger: Logger) {
    logger.log("Call someMethod");
  }
}

it("some_test", () => {
  const logger = new Logger(true); // 테스트 환경 표시
  const controller = new Controller();
  controller.someMethod(logger);
});
