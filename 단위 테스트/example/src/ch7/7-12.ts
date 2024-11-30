/**
 * 도메인 이벤트는 항상 이미 발생한 일을 나타냄
 * 그러므로 항상 과거 시제로 명명해야한다
 */
class EmailChangedEvent {
  constructor(private userId: number, private newEmail: string) {}
}

class User {
  userId: string;
  email: string;
  type: string;
  emailChangedEvents: EmailChangedEvent[] = [];
  private isEmailConfirmed: boolean;

  private canChangeEmail() {
    return this.isEmailConfirmed ? false : true;
  }

  changeEmail(newEmail: string, company: Company) {
    if (!this.canChangeEmail()) {
      throw new Error("이메일이 이미 확인되었습니다.");
    }

    if (this.email === newEmail) {
      return;
    }

    const newType = company.isEmailCorporate(newEmail)
      ? UserType.EMPLOYEE
      : UserType.CUSTOMER;

    if (this.type !== newType) {
      const delta = newType === UserType.EMPLOYEE ? 1 : -1;
      company.changeNumberOfEmployees(delta);
    }

    this.email = newEmail;
    this.type = newType;
    this.emailChangedEvents.push(new EmailChangedEvent(this.userId, newEmail));
  }
}
