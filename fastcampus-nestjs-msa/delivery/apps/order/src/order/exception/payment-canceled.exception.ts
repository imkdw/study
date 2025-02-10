import { HttpException, HttpStatus } from '@nestjs/common';

export class PaymentCanceledException extends HttpException {
  constructor(message: unknown) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
