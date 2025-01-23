import { SurveyPermissionChecker } from "./SurveryPermissionChecker.js";

export class CreateServeyService {
  constructor(private readonly permissionChecker: SurveyPermissionChecker) {}

  createSurvey(req: CreateSurveyRequest): number {
    this.validate(req);

    if (!this.permissionChecker.hasUserCreatePermission(req.getRequestorId())) {
      throw new NoPermissionException();
    }
  }

  private validate(req: CreateSurveyRequest) {
    // ...
  }
}
