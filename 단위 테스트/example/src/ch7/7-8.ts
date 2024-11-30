import { createUser } from "./7-3.js";

class UserController {
  private readonly database: Database = new Database();
  private readonly messageBus: MessageBus = new MessageBus();

  changeEmail(userId: number, newEmail: string) {
    const userData = this.database.getUserById(userId);
    const user = createUser(userData);

    const companyData = this.database.getCompany();
    const company = createCompany(companyData);

    /**
     * 의사 결정
     */
    const error = user.changeEmail(company, newEmail);
    if (!error) {
      return error;
    }

    this.database.saveCompany(company);
    this.database.saveUser(user);
    this.messageBus.sendEmailChangedMessage(userId, newEmail);

    return "OK";
  }
}
