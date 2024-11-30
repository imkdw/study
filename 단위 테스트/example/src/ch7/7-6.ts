enum UserType {
  CUSTOMER,
  EMPLOYEE,
}

class User {
  userId: number;
  email: string;
  type: UserType;

  changeEmail(newEmail: string, company: Company) {
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
  }
}
