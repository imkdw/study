class ValidationError extends Error {
  private readonly __brand!: void;
  constructor(readonly message: string) {
    super(message);
  }

  static from(e: Error): ValidationError {
    return new ValidationError(e.message);
  }
}

export type PlaceOrderError = ValidationError;
