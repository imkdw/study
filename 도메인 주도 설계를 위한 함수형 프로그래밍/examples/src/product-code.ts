/**
 * 제약 : W로 시작하고 4자리의 숫자를 가짐
 */
class WidgetCode {
  private readonly __brand!: void;
  constructor(readonly value: string) {}
}

/**
 * 제약 : G로 시작하고 4자리의 숫자를 가짐
 */
class GimzoCode {
  private readonly __brand!: void;
  constructor(readonly value: string) {}
}

type ProductCode = WidgetCode | GimzoCode;
