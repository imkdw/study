function* naturals(end = Infinity): IterableIterator<number> {
  let n = 1;
  while (n <= end) {
    yield n++;
  }
}

function* map<A, B>(f: (a: A) => B, iterable: Iterable<A>): IterableIterator<B> {
  const iterator = iterable[Symbol.iterator]();

  while (true) {
    const { done, value } = iterator.next();
    if (done) {
      break;
    }

    yield f(value);
  }
}

function forEach<A>(f: (a: A) => void, iterable: Iterable<A>): void {
  for (const a of iterable) {
    f(a);
  }
}

function* filter<A>(f: (a: A) => boolean, iterable: Iterable<A>): IterableIterator<A> {
  const iterator = iterable[Symbol.iterator]();
  while (true) {
    const { done, value } = iterator.next();
    if (done) break;
    if (f(value)) yield value;
  }
}

function baseReduce<A, Acc>(f: (acc: Acc, a: A) => Acc, acc: Acc, iterator: Iterator<A>): Acc {
  while (true) {
    const { done, value } = iterator.next();
    if (done) {
      break;
    }
    acc = f(acc, value);
  }

  return acc;
}

function reduce<A, Acc>(f: (acc: Acc, a: A) => Acc, acc: Acc, iterable: Iterable<A>): Acc;
function reduce<A, Acc>(f: (a: A, b: A) => Acc, iterable: Iterable<A>): Acc;
function reduce<A, Acc>(f: (a: Acc | A, b: A) => Acc, accOrIterable: Acc | Iterable<A>, iterable?: Iterable<A>): Acc {
  if (!iterable) {
    const iterator = (accOrIterable as Iterable<A>)[Symbol.iterator]();
    const { done, value: acc } = iterator.next();
    if (done) {
      throw new TypeError("'reduce' of empty iterable with no initial value");
    }

    return baseReduce(f, acc, iterator) as Acc;
  } else {
    return baseReduce(f, accOrIterable as Acc, iterable[Symbol.iterator]()) as Acc;
  }
}

function* take<A>(limit: number, iterable: Iterable<A>): IterableIterator<A> {
  const iterator = iterable[Symbol.iterator]();
  while (true) {
    const { done, value } = iterator.next();
    if (done) {
      break;
    }

    yield value;
    if (--limit === 0) {
      break;
    }
  }
}

function head<A>(iterable: Iterable<A>): A | undefined {
  return iterable[Symbol.iterator]().next().value;
}

class FxIterable<A> {
  constructor(private iterable: Iterable<A>) {}

  map<B>(f: (a: A) => B): FxIterable<B> {
    return fx(map(f, this));
  }

  filter(f: (a: A) => boolean): FxIterable<A> {
    return fx(filter(f, this));
  }

  forEach(f: (a: A) => void): void {
    return forEach(f, this);
  }

  reduce<Acc>(f: (acc: Acc, a: A) => Acc, acc: Acc): Acc;
  reduce<Acc>(f: (a: A, b: A) => Acc): Acc;
  reduce<Acc>(f: (a: Acc | A, b: A) => Acc, acc?: Acc): Acc {
    return !acc ? reduce(f, this) : reduce(f, acc, this);
  }

  [Symbol.iterator]() {
    return this.iterable[Symbol.iterator]();
  }

  reject(f: (a: A) => boolean): FxIterable<A> {
    return this.filter((a) => !f(a));
  }

  to<R>(converter: (iterable: Iterable<A>) => R): R {
    return converter(this.iterable);
  }

  chain<B>(f: (iterable: Iterable<A>) => Iterable<B>): FxIterable<B> {
    return fx(f(this));
  }

  take(limit: number): FxIterable<A> {
    return fx(take(limit, this));
  }
}

const fx = <A>(iterable: Iterable<A>): FxIterable<A> => new FxIterable(iterable);

function find<A>(f: (a: A) => boolean, iterable: Iterable<A>): A | undefined {
  return fx(iterable).filter(f).to(head);
}

function accumulateWith<A>(
  accumulator: (a: boolean, b: boolean) => boolean,
  acc: boolean,
  taking: (a: boolean) => boolean,
  f: (a: A) => boolean,
  iterable: Iterable<A>
): boolean {
  return fx(iterable).map(f).filter(taking).take(1).reduce(accumulator, acc);
}

function every<A>(f: (a: A) => boolean, iterable: Iterable<A>): boolean {
  return accumulateWith(
    (a, b) => a && b,
    true,
    (a) => !a,
    f,
    iterable
  );
}

function some<A>(f: (a: A) => boolean, iterable: Iterable<A>): boolean {
  return accumulateWith(
    (a, b) => a || b,
    false,
    (a) => a,
    f,
    iterable
  );
}

function* concat<A>(...iterables: Iterable<A>[]): IterableIterator<A> {
  for (const iterable of iterables) {
    yield* iterable;
  }
}

const arr = [3, 4, 5];
console.log(some((n) => n < 3, arr)); // false

const iter = concat([1, 2], arr);
console.log(some((n) => n < 3, iter)); // true
