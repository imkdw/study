import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ResgisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  age: number;

  @IsString()
  @IsNotEmpty()
  profile: string;
}
