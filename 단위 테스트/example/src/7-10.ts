class User {
  // ...

  canChangeEmail() {
    if (this.isEmailConfirmed) {
      return false;
    }

    return true;
  }

  changeEmail(newEmail: string, company: Company) {
    if (!this.changeEmail()) {
      throw new Error("이메일이 이미 확인되었습니다.");
    }

    // ...
  }
}
