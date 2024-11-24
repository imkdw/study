class User {
  private _name: string;

  constructor(name: string) {
    this._name = this.normalizeName(name);
  }

  getName() {
    return this._name;
  }

  setName(name: string) {
    this._name = this.normalizeName(name);
  }

  private normalizeName(name: string) {
    const result = (name ?? "").trim();
    if (result.length > 50) {
      return result.slice(0, 50);
    }

    return result;
  }
}

class UserController {
  renameUser(userId: number, newName: string) {
    const user = getUserFromDatabase(userId);
    user.setName;
  }
}
