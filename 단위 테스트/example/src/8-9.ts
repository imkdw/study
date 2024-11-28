class User {
  changeEmail(newEmail: string, company: Company, logger: ILogger) {
    logger.info(`changeEmail: ${this.userId}`);

    // ...

    logger.info(`changeEmail: done: ${this.userId}`);
  }
}
