export interface AccountRepository {
  findById(accountId: number): Promise<any>;
}
