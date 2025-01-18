interface ChangePasswordRequest {
  memberId: string;
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordService {
  constructor() {}

  changePassword(request: ChangePasswordRequest) {
    // ...
  }
}
