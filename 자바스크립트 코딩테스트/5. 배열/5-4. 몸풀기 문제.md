# 배열 정렬하기

- 정수 배열을 정렬해서 반환하기

```js
/**
 * @param {number[]} arr
 */
const solution = (arr) => {
  return arr.sort((a, b) => a - b);
};

console.log(solution([1, 5, 2, 6, 3, 7, 4])); // [1, 2, 3, 4, 5, 6, 7]
```

<br/>

# 배열 제어하기

- 배열 중복값 제거하기
- 배열 데이터를 내림차순으로 정렬하기

```js
function solution(arr) {
  return Array.from(new Set(arr)).sort((a, b) => b - a);
}

console.log(solution([4, 2, 2, 1, 3, 4])); // 4 3 2 1
console.log(solution([2, 1, 1, 3, 2, 5, 4])); // 5 4 3 2 1
```

<br/>

# 두 개 뽑아서 더하기

- 서로 다른 인덱스에 존재하는 2개의 수를 뽑아 만들 수 있는 모든 수를 배열에 오름차순 정렬

```js
/**
 * @param {number[]} arr
 */
function solution(arr) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      result.push(arr[i] + arr[j]);
    }
  }

  return Array.from(new Set(result)).sort((a, b) => a - b);
}

console.log(solution([2, 1, 3, 4, 1])); // 2 3 4 5 6 7
console.log(solution([5, 0, 2, 7])); // 2 5 7 9 12
```

<br>

# 모의고사

```js
/**
 * @param {number[]} arr
 */
function solution(answers) {
  const patterns = [
    [1, 2, 3, 4, 5],
    [2, 1, 2, 3, 2, 4, 2, 5],
    [3, 3, 1, 1, 2, 2, 4, 4, 5, 5],
  ];

  const scores = [0, 0, 0];

  for (const [i, answer] of answers.entries()) {
    for (const [j, pattern] of patterns.entries()) {
      if (answer === pattern[i % pattern.length]) {
        scores[j] += 1;
      }
    }
  }

  const maxScore = Math.max(...scores);

  const highestScores = [];
  scores.forEach((score, index) => {
    if (score === maxScore) {
      highestScores.push(index + 1);
    }
  });

  return highestScores;
}

console.log(solution([1, 2, 3, 4, 5])); // 1
console.log(solution([1, 3, 2, 4, 2])); // 1 2 3
```
