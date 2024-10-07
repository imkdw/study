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
