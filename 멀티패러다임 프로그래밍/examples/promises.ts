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
function reduce<A, Acc>(f: (acc: Acc, a: A) => Acc, acc: Acc, asyncIterable: AsyncIterable<A>): Promise<Acc>;
function reduce<A, Acc>(
  f: (acc: Acc, a: A) => Acc,
  acc: Acc,
  iterable: Iterable<A> | AsyncIterable<A>
): Acc | Promise<Acc> {
  return isIterable(iterable) ? reduceSync(f, acc, iterable) : reduceAsync(f, acc, iterable);
}

function toAsync<T>(iterable: Iterable<T | Promise<T>>): AsyncIterable<Awaited<T>> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<Awaited<T>> {
      const iterator = iterable[Symbol.iterator]();
      return {
        async next() {
          const { done, value } = iterator.next();
          return done ? { done, value } : { done: false, value: await value };
        },
      };
    },
  };
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

function* filterSync<A>(f: (a: A) => boolean, iterable: Iterable<A>): IterableIterator<A> {
  for (const value of iterable) {
    if (f(value)) {
      yield value;
    }
  }
}

async function* mapAsync<A, B>(f: (a: A) => B, asyncIterable: AsyncIterable<A>): AsyncIterableIterator<Awaited<B>> {
  for await (const value of asyncIterable) {
    yield f(value);
  }
}

async function* filterAsync<A>(
  f: (a: A) => Promise<boolean> | boolean,
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

function fx<A>(iterable: Iterable<A>): FxIterable<A>;
function fx<A>(asyncIterable: AsyncIterable<A>): FxAsyncIterable<A>;
function fx<A>(iterable: Iterable<A> | AsyncIterable<A>): FxIterable<A> | FxAsyncIterable<A> {
  return isIterable(iterable) ? new FxIterable(iterable) : new FxAsyncIterable(iterable);
}

async function fromAsync<T>(iterable: Iterable<Promise<T>> | AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const a of iterable) {
    arr.push(a);
  }

  return arr;
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

  toArray() {
    return fromAsync(this);
  }

  reduce<Acc>(f: (acc: Acc, a: A) => Acc | Promise<Acc>, acc: Acc): Promise<Acc> {
    return reduce(f as (acc: Acc, a: A) => Acc, acc, this);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
  });
}

async function calcTotalHeight(urls: string[]) {
  try {
    const totalHeight = await fx(urls)
      .toAsync()
      .map(loadImage)
      .map((img) => img.height)
      .reduce((a, b) => a + b, 0);

    return totalHeight;
  } catch (error) {
    console.error(error);
  }
}

console.log(
  await calcTotalHeight([
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTFYqoKTu_o3Zns2yExbst2Co84Gpc2Q1RJbA&s",
  ])
);

const getTotalHeight = (urls: string[]) =>
  fx(toAsync(urls))
    .map(loadImage)
    .map((img) => img.height)
    .reduce((a, b) => a + b, 0);

try {
  const height = await getTotalHeight([]);
} catch (error) {
  console.error(error);
}
