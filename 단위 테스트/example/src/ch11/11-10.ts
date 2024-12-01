interface ILogger {
  log(text: string): void;
}

class Logger implements ILogger {
  log(text: string) {
    // text logging...
  }
}

class FakeLogger implements ILogger {
  log(text: string): void {
    // do nothing
  }
}

it("some_test", () => {
  const logger = new FakeLogger();
  const controller = new Controller();
  controller.someMethod(logger);
});
