/**
 * DIP(Dependency Inversion Principle) - 의존성 역전 원칙
 *
 * 고수준 모듈은 저수준 모듈에 의존하면 안됨
 * 둘 다 추상화에 의존해야함
 */
interface IDatabase {
  save(data: string): void;
}

class MysqlDatabase implements IDatabase {
  save(data: string): void {}
}

class MongoDbDatabase implements IDatabase {
  save(data: string): void {}
}

class HighLevelModule {
  constructor(private database: IDatabase) {}

  execute(data: string): void {
    this.database.save(data);
  }
}

const mysql: MysqlDatabase = new MysqlDatabase();
const mongo: MongoDbDatabase = new MongoDbDatabase();
const user = new HighLevelModule(mysql);
user.execute("data");
