import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsString, IsUUID } from 'class-validator';
import { PaymentMethod } from '../entity/payment.entity';

export class MakePaymentDto {
  @IsUUID()
  orderId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsNumber()
  amount: number;

  @IsString()
  @IsNotEmpty()
  cardNumber: string;

  @IsString()
  @IsNotEmpty()
  expiryYear: string;

  @IsString()
  @IsNotEmpty()
  expiryMonth: string;

  @IsString()
  @IsNotEmpty()
  birthOrRegistration: string;

  @IsString()
  @IsNotEmpty()
  passwordTwoDigits: string;

  @IsEmail()
  userEmail: string;
}
