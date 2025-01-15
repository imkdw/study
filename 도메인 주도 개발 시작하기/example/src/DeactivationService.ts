export class DeactivationService {
  deactivate(memberId: string, password: string) {
    const member = this.memberRepository.findById(memberId);
    checkMemberExists(member);
    if (!this.passwordEncoder.matches(password, member.getPassword())) {
      throw new Error("비밀번호가 일치하지 않습니다.");
    }

    member.deactivate();
  }
}
