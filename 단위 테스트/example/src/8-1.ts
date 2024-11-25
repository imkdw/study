import { createUser } from "./7-3.js";

class UserController {
  private readonly database: Database = new Database();
  private readonly messageBus: MessageBus = new MessageBus();

  changeEmail(userId: number, newEmail: string) {
    const userData = this.database.getUserById(userId);
    const user = UserFactory.create(userData);

    const error = user.canChangeEmail();
    if (error !== null) {
      return error;
    }

    const companyData = this.database.getCompany();
    const company = CompanyFactory.create(companyData);

    user.changeEmail(company, newEmail);

    this.database.saveCompany(company);
    this.database.saveUser(user);
    user.emailChangedEvents.forEach((event) => {
      this.messageBus.sendEmailChangedMessage(event.userId, event.newEmail);
    });

    return "ok";
  }
}
