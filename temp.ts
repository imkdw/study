function* naturals(end = Infinity): IterableIterator<number> {
  let n = 1;
  while (n <= end) {
    yield n++;
  }
}

function* map<A, B>(f: (a: A) => B, iterable: Iterable<A>): IterableIterator<B> {
  for (const a of iterable) {
    yield f(a);
  }
}

function forEach<A>(f: (a: A) => void, iterable: Iterable<A>): void {
  for (const a of iterable) {
    f(a);
  }
}

function* filter<A>(f: (a: A) => boolean, iterable: Iterable<A>): IterableIterator<A> {
  for (const a of iterable) {
    if (f(a)) {
      yield a;
    }
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
}

function fx<A>(iterable: Iterable<A>): FxIterable<A> {
  return new FxIterable(iterable);
}

const result = fx([5, 2, 3, 1, 4, 5, 3])
  .filter((n) => n % 2 === 1)
  .map((n) => n * 10) // [10, 30, 30, 50, 50]
  .chain((iterable) => new Set(iterable)) // Set(3) { 10, 30, 50 }
  .reduce((acc, n) => acc + n); // 90

console.log(result); // 90
