class UserController {
  private readonly database: Database = new Database();
  private readonly messageBus: MessageBus = new MessageBus();

  changeEmail(userId: number, newEmail: string) {
    const data = this.database.getById(userId);
    const email = data[1];
    const type = data[2];
    const user = new User(userId, email, type);

    const companyData = this.database.getCompany();
    const companyDomainName = companyData[0];
    const numberOfEmployees = companyData[1];

    const newNumberOfEmployees = user.changeEmail(
      newEmail,
      companyDomainName,
      numberOfEmployees
    );

    this.database.saveCompany(newNumberOfEmployees);
    this.database.saveUser(user);
    this.messageBus.sendEmailChangedMessage(userId, newEmail);
  }
}
