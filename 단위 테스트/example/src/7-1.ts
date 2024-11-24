enum UserType {
  CUSTOMER,
  EMPLOYEE,
}

class User {
  userId: number;
  email: string;
  type: UserType;

  changeEmail(
    newEmail: string,
    companyDomainName: string,
    numberOfEmployees: number
  ) {
    if (this.email === newEmail) {
      return numberOfEmployees;
    }

    const emailDomain = newEmail.split("@")[1];
    const isEmailCorporate = emailDomain === companyDomainName;
    const newType = isEmailCorporate ? UserType.EMPLOYEE : UserType.CUSTOMER;

    if (this.type !== newType) {
      const delta = newType === UserType.EMPLOYEE ? 1 : -1;
      const newNumber = numberOfEmployees + delta;
      numberOfEmployees = newNumber;
    }

    this.email = newEmail;
    this.type = newType;

    return numberOfEmployees;
  }
}
