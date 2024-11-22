import { isStringLong, parse } from "../1-2.js";

describe.skip("isStringLong", () => {
  it("문자열의 길이가 5보다 크다면 true 반환", () => {
    expect(isStringLong("123456")).toBe(true);
  });

  it("문자열의 길이가 5보다 작다면 false 반환", () => {
    expect(isStringLong("1234")).toBe(false);
  });
});

describe("parse", () => {
  it("`1234`를 숫자로 변환하면 1234다", () => {
    expect(parse("1234")).toBe(1234);
  });
});
