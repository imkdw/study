function* reverse<T>(arrLike: ArrayLike<T>): Iterator<T> {
  let index = arrLike.length;

  while (index) {
    yield arrLike[--index];
  }
}

const array = ["A", "B", "C", "D", "E", "F"];
const reversed = reverse(array);

console.log(reversed.next().value); // F
console.log(reversed.next().value); // E
console.log(reversed.next().value); // D
console.log(reversed.next().value); // C
console.log(reversed.next().value); // B
console.log(reversed.next().value); // A
console.log(reversed.next().value); // undefined
