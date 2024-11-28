import { createUser } from "./7-3.js";

class UserController {
  private readonly database: Database;
  private readonly messageBus: MessageBus;
  private readonly eventDispatcher: EventDispatcher;

  constructor(database: Database, messageBus: MessageBus) {
    this.database = database;
    this.messageBus = messageBus;
  }

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

    // 사용자 도메인 이벤트 전달
    this.eventDispatcher.dispatch(user.domainEvents);

    return "ok";
  }
}
