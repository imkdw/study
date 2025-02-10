import { IsEnum, IsNumber, IsString } from 'class-validator';
import { PaymentMethod } from '../entity/payment.entity';

export class PaymentDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsString()
  paymentName: string;

  @IsString()
  cardNumber: string;

  @IsString()
  expiryYear: string;

  @IsString()
  expiryMonth: string;

  @IsString()
  birthOrRegistration: string;

  @IsString()
  passwordTwoDigits: string;

  @IsNumber()
  amount: number;
}
