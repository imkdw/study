class User {
  private userId: string;
  private email: string;
  private type: string;

  private logger: ILogger;
  private domainLogger: IDomainLogger;

  changeEmail(newEmail: string, company: Company) {
    // 진단 로그
    this.logger.info(`changeEmail: ${this.userId}`);

    if (this.email === newEmail) {
      return;
    }

    const newType = company.isEmailCorporate(newEmail) ? UserType.CORPORATE : UserType.PERSONAL;

    if (type !== newType) {
      const delta = newType === UserType.CORPORATE ? 1 : -1;
      company.changeNumberOfEmployees(delta);

      // 지원 로그
      this.domainLogger.userTypeHasChanged(this.userId, this.type, newType);
    }

    this.email = newEmail;
    this.type = newType;

    this.logger.info(`changeEmail: done: ${this.userId}`);
  }
}
