import { IsNumber } from "class-validator";

export class PagePaginationDto {
  @IsNumber()
  page: number = 1;

  @IsNumber()
  take: number = 5;
} 
