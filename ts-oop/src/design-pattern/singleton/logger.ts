/**
 * Singleton 패턴
 *
 * 생성자가 여러번 호출되도 실제로 생성되는 객체는 하나다
 * 매번 인스턴스를 만드는게 아닌 최초에 생성된 인스턴스를 계속해서 반환해준다
 */
class Logger {
  private static instance: Logger;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }

    return Logger.instance;
  }

  log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }
}

const logger1 = Logger.getInstance();
logger1.log("message 1");

const logger2 = Logger.getInstance();
logger2.log("message 2");

class Application {
  constructor(private logger: Logger) {}

  run(): void {
    this.logger.log("App is running");
  }
}

const logger = Logger.getInstance();
const app = new Application(logger);
app.run();
