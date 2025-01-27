interface LockManager {
  tryLock(type: string, id: string): LockId;
  checkLock(lockId: LockId): void;
  releaseLock(lockId: LockId): void;
  extenLockExpiration(lockId: LockId, inc: number): void;
}
