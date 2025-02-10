import { IsEmail, IsString } from 'class-validator';

export class SendPaymentNotificationDto {
  @IsEmail()
  to: string;

  @IsString()
  orderId: string;
}
