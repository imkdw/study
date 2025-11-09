class ArrayLikeIterator<T> implements Iterator<T> {
  private index = 0;

  constructor(private arrayLike: ArrayLike<T>) {}

  next(): IteratorResult<T> {
    if (this.index < this.arrayLike.length) {
      return {
        value: this.arrayLike[this.index++],
        done: false,
      };
    } else {
      return {
        value: undefined,
        done: true,
      };
    }
  }
}

const arrayLike: ArrayLike<number> = {
  0: 10,
  1: 20,
  2: 30,
  length: 3,
};

const iterator: Iterator<number> = new ArrayLikeIterator(arrayLike);

console.log(iterator.next()); // { value: 10, done: false }
console.log(iterator.next()); // { value: 20, done: false }
console.log(iterator.next()); // { value: 30, done: false }
console.log(iterator.next()); // { value: undefined, done: true }
