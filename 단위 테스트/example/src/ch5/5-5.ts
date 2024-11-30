class User {
  constructor(private name: string) {}

  nomalizedName(name: string) {
    const result = name.trim();

    if (result.length > 50) {
      return result.slice(0, 50);
    }

    return result;
  }
}

class UserController {
  renameUser(userId: number, newName: string) {
    const user = getUserFromDatabase(userId);

    const normalizedName = user.nomalizedName(newName);
    user.name = normalizedName;

    saveUserToDatabase(user);
  }
}
