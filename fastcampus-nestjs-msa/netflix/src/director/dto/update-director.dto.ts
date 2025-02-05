import { IsDateString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateDirectorDto {
  @IsNotEmpty()
  name?: string;

  @IsNotEmpty()
  @IsDateString()
  dob?: Date;

  @IsNotEmpty()
  nationality?: string;
}
