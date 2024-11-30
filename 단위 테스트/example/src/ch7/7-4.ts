class Company {
  domainName: string;
  numberOfEmployees: number;

  changeNumberOfEmployees(delta: number) {
    if (this.numberOfEmployees + delta <= 0) {
      throw new Error("Invalid number of employees");
    }

    this.numberOfEmployees += delta;
  }

  isEmailCorporate(email: string) {
    const emailDomain = email.split("@")[1];
    return emailDomain === this.domainName;
  }
}
