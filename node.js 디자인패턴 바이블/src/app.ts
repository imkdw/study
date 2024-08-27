// counter.ts
export let count = 0;
export function increment() {
  count += 1;
}

// main.ts
import { count, increment } from "./counter";
console.log(count); // 0
increment();
console.log(count); // 1
count += 1; // TypeError: Assignment to constant variable!
