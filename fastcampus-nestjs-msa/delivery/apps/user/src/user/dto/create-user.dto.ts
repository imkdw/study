import { IsEmail, IsNumber, IsString } from 'class-validator';

import { IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNumber()
  age: number;

  @IsString()
  profile: string;
}
