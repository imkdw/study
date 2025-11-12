function reverse<T>(arrayLike: ArrayLike<T>): Iterator<T> {
  let index = arrayLike.length;

  return {
    next() {
      if (index === 0) {
        return { value: undefined, done: true };
      } else {
        return { value: arrayLike[--index], done: false };
      }
    },
  };
}

function map<A, B>(
  transform: (value: A) => B,
  iterator: Iterator<A>
): Iterator<B> {
  return {
    next(): IteratorResult<B> {
      const { value, done } = iterator.next();
      return done ? { value, done } : { value: transform(value), done: false };
    },
  };
}

const array = ["A", "B", "C", "D", "E", "F"];
const iterator = map((str: string) => str.toLowerCase(), reverse(array));
console.log(iterator.next().value, iterator.next().value);
