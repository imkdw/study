class DateTimeServer {
  private static func: () => Date = () => new Date();
  private static now: Date;

  static init() {
    this.now = this.func();
  }
}

// 운영환경
DateTimeServer.init(() => new Date());

// 테스트환경
DateTimeServer.init(() => new Date("2020-01-01"));
