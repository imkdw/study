class UserRepository {
  private readonly transaction: Transaction;

  constructor(transaction: Transaction) {
    this.transaction = transaction;
  }

  // ...
}

class Transaction implements IDisposable {
  commit(): void {
    // ...
  }
  rollback(): void {
    // ...
  }
}

interface IDisposable {
  commit(): void;
  rollback(): void;
}
