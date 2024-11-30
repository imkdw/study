class User {
  // 기존 속성...
  isEmailConfirmed: boolean;

  changeEmail(newEmail: string, company: Company) {
    if (this.isEmailConfirmed) {
      return "이메일이 이미 확인되었습니다.";
    }
    // ...
  }
}
