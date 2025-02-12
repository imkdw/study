import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  age: number;

  @IsString()
  @IsNotEmpty()
  profile: string;
}
