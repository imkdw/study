import Calculator from "../../3-1";

it("sum_of_two_numbers", () => {
  const first = 10;
  const second = 20;
  const calculator = new Calculator();

  const sut = calculator.sum(first, second);

  expect(sut).toBe(30);
});
