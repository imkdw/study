it.each([
  [1, 3, 4],
  [11, 33, 44],
  [100, 500, 600],
])("adding_two_numbers", (value1, value2, expected) => {
  const sut = Calculator.add(value1, value2);

  expect(sut).toBe(expected);
});
