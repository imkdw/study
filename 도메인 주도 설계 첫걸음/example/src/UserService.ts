export class UserService {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  create(contactDetails: ContactDetails) {
    let result: OperationResult | null = null;
    try {
      this.db.startTransaction();

      const user = new User();
      user.setContactDetails(contactDetails);
      user.save();

      this.db.commit();
    } catch (err) {
      this.db.rollback();
      result = OperationResult.exception(err);
    }

    return result;
  }
}
