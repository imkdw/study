import { IsArray, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CursorPaginationDto {
  @IsInt()
  @IsOptional()
  // id_52, likeCount_ 20
  page: string;

  @IsArray()
  @IsString({ each: true })
  // ['id_ASC', 'likeCount_DESC']
  order: string[] = [];
}
