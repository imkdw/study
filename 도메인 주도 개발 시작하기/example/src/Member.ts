export class Member {
  changePassword(oldPassword: string, newPassword: string) {
    if (!this.matchPassword(oldPassword)) {
      throw new Error("기존 비밀번호가 일치하지 않습니다.");
      setPassword(newPassword);
    }
  }

  matchPassword(password: string) {
    return this.passwordEncoder.matches(password);
  }

  private setPassword(newPassword: string) {
    if (!newPassword) {
      throw new Error("비밀번호를 입력해주세요.");
    }
    this.password = newPassword;
  }
}

export class ChangePasswordService {
  changePassword(memberId: string, oldPassword: string, newPassword: string) {
    const member = this.memberRepository.findById(memberId);
    this.checkMemberExists(member);
    member.changePassword(oldPassword, newPassword);
  }
}
