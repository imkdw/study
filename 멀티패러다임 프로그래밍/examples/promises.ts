function* naturals(end = Infinity): IterableIterator<number> {
  let n = 1;
  while (n <= end) {
    yield n++;
  }
}

function isOdd(n: number): boolean {
  return n % 2 === 1;
}

const delay = <T>(time: number, value: T): Promise<T> => new Promise((resolve) => setTimeout(resolve, time, value));

async function* toAsync<T>(iterable: Iterable<T | Promise<T>>): AsyncIterableIterator<Awaited<T>> {
  for await (const value of iterable) {
    yield value;
  }
}

function mapSync<A, B>(f: (a: A) => B, iterable: Iterable<A>): IterableIterator<B> {
  const iterator = iterable[Symbol.iterator]();
  return {
    next() {
      const { value, done } = iterator.next();
      return done ? { value: undefined, done: true } : { value: f(value), done: false };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}

async function* mapAsync<A, B>(f: (a: A) => B, asyncIterable: AsyncIterable<A>): AsyncIterableIterator<Awaited<B>> {
  for await (const value of asyncIterable) {
    yield f(value);
  }
}

function* filterSync<A>(f: (a: A) => boolean, iterable: Iterable<A>): IterableIterator<A> {
  for (const value of iterable) {
    if (f(value)) {
      yield value;
    }
  }
}

async function* filterAsync<A>(
  f: (a: A) => boolean | Promise<boolean>,
  asyncIterable: AsyncIterable<A>
): AsyncIterableIterator<A> {
  for await (const value of asyncIterable) {
    if (await f(value)) {
      yield value;
    }
  }
}

function isIterable<T = unknown>(a: Iterable<T> | unknown): a is Iterable<T> {
  return typeof a?.[Symbol.iterator as unknown as keyof typeof a] === "function";
}

function map<A, B>(f: (a: A) => B, iterable: Iterable<A>): IterableIterator<B>;
function map<A, B>(f: (a: A) => B, asyncIterable: AsyncIterable<A>): AsyncIterableIterator<Awaited<B>>;
function map<A, B>(
  f: (a: A) => B,
  iterable: Iterable<A> | AsyncIterable<A>
): IterableIterator<B> | AsyncIterableIterator<Awaited<B>> {
  return isIterable(iterable) ? mapSync(f, iterable) : mapAsync(f, iterable);
}

function filter<A>(f: (a: A) => boolean, iterable: Iterable<A>): IterableIterator<A>;
function filter<A>(f: (a: A) => boolean | Promise<boolean>, asyncIterable: AsyncIterable<A>): AsyncIterableIterator<A>;
function filter<A>(
  f: (a: A) => boolean | Promise<boolean>,
  iterable: Iterable<A> | AsyncIterable<A>
): IterableIterator<A> | AsyncIterableIterator<A> {
  return isIterable(iterable) ? filterSync(f as (a: A) => boolean, iterable) : filterAsync(f, iterable);
}

async function fromAsync<T>(iterable: Iterable<Promise<T>> | AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const a of iterable) {
    arr.push(a);
  }

  return arr;
}

function fx<A>(iterable: Iterable<A>): FxIterable<A>;
function fx<A>(asyncIterable: AsyncIterable<A>): FxAsyncIterable<A>;
function fx<A>(iterable: Iterable<A> | AsyncIterable<A>): FxIterable<A> | FxAsyncIterable<A> {
  return isIterable(iterable) ? new FxIterable(iterable) : new FxAsyncIterable(iterable);
}

class FxIterable<A> implements Iterable<A> {
  constructor(private readonly iterable: Iterable<A>) {}

  [Symbol.iterator]() {
    return this.iterable[Symbol.iterator]();
  }

  map<B>(f: (a: A) => B): FxIterable<B> {
    return fx(map(f, this.iterable));
  }

  filter(f: (a: A) => boolean): FxIterable<A> {
    return fx(filter(f, this.iterable));
  }

  reduce<Acc>(f: (acc: Acc, a: A) => Acc, acc: Acc): Acc {
    return reduce(f, acc, this.iterable);
  }

  toArray(): A[] {
    return [...this];
  }

  toAsync() {
    return fx(toAsync(this));
  }
}

class FxAsyncIterable<A> implements AsyncIterable<A> {
  constructor(private readonly asyncIterable: AsyncIterable<A>) {}

  [Symbol.asyncIterator]() {
    return this.asyncIterable[Symbol.asyncIterator]();
  }

  map<B>(f: (a: A) => B) {
    return fx(map(f, this));
  }

  filter(f: (a: A) => boolean | Promise<boolean>) {
    return fx(filter(f, this));
  }

  reduce<Acc>(f: (acc: Acc, a: A) => Acc | Promise<Acc>, acc: Acc) {
    return reduce(f, acc, this);
  }

  toArray() {
    return fromAsync(this);
  }
}

function reduceSync<A, Acc>(f: (acc: Acc, a: A) => Acc, acc: Acc, iterable: Iterable<A>): Acc {
  for (const a of iterable) {
    acc = f(acc, a);
  }
  return acc;
}

async function reduceAsync<A, Acc>(
  f: (acc: Acc, a: A) => Acc,
  acc: Acc,
  asyncIterable: AsyncIterable<A>
): Promise<Acc> {
  for await (const a of asyncIterable) {
    acc = f(acc, a);
  }
  return acc;
}

function reduce<A, Acc>(f: (acc: Acc, a: A) => Acc, acc: Acc, iterable: Iterable<A>): Acc;
function reduce<A, Acc>(
  f: (acc: Acc, a: A) => Acc | Promise<Acc>,
  acc: Acc,
  asyncIterable: AsyncIterable<A>
): Promise<Acc>;
function reduce<A, Acc>(
  f: (acc: Acc, a: A) => Acc,
  acc: Acc,
  iterable: Iterable<A> | AsyncIterable<A>
): Acc | Promise<Acc> {
  return isIterable(iterable) ? reduceSync(f, acc, iterable) : reduceAsync(f, acc, iterable);
}
