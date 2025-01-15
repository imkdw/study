export class ChangePasswordService {
  changePassword(memberId: string, oldPassword: string, newPassword: string) {
    const member = this.memberRepository.findById(memberId);
    this.checkMemberExists(member);

    if (!this.passwordEncoder.matches(oldpassword, member.getPassword())) {
      throw new Error("기존 비밀번호가 일치하지 않습니다.");
    }

    member.setPassword(newPassword);
  }
}
