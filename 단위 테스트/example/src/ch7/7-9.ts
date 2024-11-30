import { createUser } from "./7-3.js";

class UserController {
  private readonly database: Database = new Database();
  private readonly messageBus: MessageBus = new MessageBus();

  changeEmail(userId: number, newEmail: string) {
    const userData = this.database.getUserById(userId);
    const user = createUser(userData);

    /**
     * 의사결정 로직 이동
     */
    if (user.isEmailConfirmed) {
      return "ERROR_EMAIL_CONFIRMED";
    }

    const companyData = this.database.getCompany();
    const company = createCompany(companyData);

    user.changeEmail(company, newEmail);

    this.database.saveCompany(company);
    this.database.saveUser(user);
    this.messageBus.sendEmailChangedMessage(userId, newEmail);

    return "OK";
  }
}
