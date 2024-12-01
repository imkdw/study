it("adding_two_numbers", () => {
  const value1 = 1;
  const value2 = 3;
  const expected = value1 + value2; // 알고리즘 유출

  const sut = Calculator.add(value1, value2);

  expect(sut).toBe(expected);
});
