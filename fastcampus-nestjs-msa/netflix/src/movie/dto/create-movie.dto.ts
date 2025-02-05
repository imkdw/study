import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateMovieDto {
  @IsString()
  title: string;

  @IsString()
  genre: string;

  @IsString()
  detail: string;

  @IsNotEmpty()
  directorId: number;
}
