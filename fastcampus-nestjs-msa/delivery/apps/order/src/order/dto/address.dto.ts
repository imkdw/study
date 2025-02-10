import { IsString } from 'class-validator';

export class AddressDto {
  @IsString()
  name: string;

  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  postalCode: string;

  @IsString()
  country: string;
}
