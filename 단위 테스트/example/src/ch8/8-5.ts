interface IDomainLogger {
  userTypeHasChanged(userId: string, oldType: string, newType: string): void;
}

class domainLogger implements IDomainLogger {
  private readonly logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  userTypeHasChanged(userId: string, oldType: string, newType: string) {
    this.logger.info(`userTypeHasChanged: ${userId}: ${oldType} -> ${newType}`);
  }
}
