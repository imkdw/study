export interface SurveyPermissionChecker {
  hasUserCreatePermission(userId: string): boolean;
}
