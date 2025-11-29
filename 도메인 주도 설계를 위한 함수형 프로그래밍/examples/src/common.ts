import assert from "assert";

interface Equatable {
  equals(obj: unknown): boolean;
}

export abstract class ValueObject implements Equatable {
  equals(obj: unknown): boolean {
    try {
      assert.deepStrictEqual(this, obj);
      return true;
    } catch {
      return false;
    }
  }
}

type RawId = string | number | bigint;

export abstract class Entity<Id extends RawId | ValueObject> implements Equatable {
  abstract readonly id: Id;
  protected abstract isSameClass<T extends Entity<Id>>(obj: unknown): obj is T;

  equals(obj: unknown): boolean {
    if (!this.isSameClass(obj)) {
      return false;
    }

    const otherId = (obj as Entity<Id>).id;

    return this.id instanceof ValueObject ? this.id.equals(otherId) : this.id === otherId;
  }
}

export type Undefined = never;
