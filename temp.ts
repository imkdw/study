const map = new Map([
  ["a", 1],
  ["b", 2],
  ["c", 3],
]);
const mapEntries = map.entries();

console.log(mapEntries.next()); // { value: ["a", 1], done: false }
console.log(mapEntries.next()); // { value: ["b", 2], done: false }
console.log(mapEntries.next()); // { value: ["c", 3], done: false }
console.log(mapEntries.next()); // { value: undefined, done: true }

const mapValues = map.values();
for (const value of mapValues) {
  console.log(value);
}

const mapKeys = map.keys();
for (const key of mapKeys) {
  // a, b, c
  console.log(key);
}
