class UnitQuantity {
  private readonly __brand!: void;
  constructor(readonly value: number) {}
}

class KilogramQuantity {
  private readonly __brand!: void;
  constructor(readonly value: number) {}
}

type OrderQuantity = UnitQuantity | KilogramQuantity;
