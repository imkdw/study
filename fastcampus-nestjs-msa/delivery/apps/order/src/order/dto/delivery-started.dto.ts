import { IsString } from 'class-validator';

export class DeliveryStartedDto {
  @IsString()
  orderId: string;
}
