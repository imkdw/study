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

const array: Array<string> = ["a", "b", "c"];
const iterator2: Iterator<string> = new ArrayLikeIterator(array);

console.log(iterator2.next()); // { value: 'a', done: false }
console.log(iterator2.next()); // { value: 'b', done: false }
console.log(iterator2.next()); // { value: 'c', done: false }
console.log(iterator2.next()); // { value: undefined, done: true }
