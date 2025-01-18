export class MemberServiceHelper {
  static findExistingMember() {
    // ...
  }
}

export class ChangePasswordService {
  changePassword(memberId: string, oldPassword: string, newPassword: string) {
    // ...
    MemberServiceHelper.findExistingMember();
    // ...
  }
}
