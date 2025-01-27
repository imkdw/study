export class DataService {
  constructor(private readonly dataDao: DataDao, private readonly lockManager: LockManager) {}

  getDataWithLock(id: number): DataLock {
    const lockId = this.lockManager.tryLock("data", id);

    const data = this.dataDao.select(id);

    return new DataAndLockId(data, lockId);
  }
}
