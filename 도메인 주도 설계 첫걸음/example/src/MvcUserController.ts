namespace MvcController {
  export class UserController {
    private readonly db: Database;
    private readonly userService: UserService;

    constructor(db: Database, userService: UserService) {
      this.db = db;
      this.userService = userService;
    }

    @Post()
    create(contactDetails: ContactDetails) {
      const result = this.userService.create(contactDetails);
      return view(result);
    }
  }
}
