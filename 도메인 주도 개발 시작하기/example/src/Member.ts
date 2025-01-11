export class Member {
  private password: Password;

  constructor(password: Password) {
    this.password = password;
  }

  changePassword(currentPassword: string, newPassword: string) {
    if (!this.password.match(currentPassword)) {
      throw new Error("invalid password");
    }

    this.password = new Password(newPassword);
  }
}
