function* map<A, B>(
  func: (value: A) => B,
  iterable: Iterable<A>
): IterableIterator<B> {
  for (const value of iterable) {
    yield func(value);
  }
}

function* naturals(end = Infinity) {
  let n = 1;
  while (n <= end) {
    yield n++;
  }
}

function* filter<T>(f: (value: T) => boolean, iterable: Iterable<T>) {
  for (const value of iterable) {
    if (f(value)) {
      yield value;
    }
  }
}

function forEach(f: (value: unknown) => void, iterable: Iterable<unknown>) {
  for (const value of iterable) {
    f(value);
  }
}

forEach(
  console.log,
  map(
    (x) => x * 10,
    filter((x) => x % 2 === 1, naturals(5))
  )
); // 10, 30, 50

const nodes = document.querySelectorAll("li");
