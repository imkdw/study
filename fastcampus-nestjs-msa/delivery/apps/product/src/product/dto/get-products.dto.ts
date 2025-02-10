import { IsArray, IsString } from 'class-validator';

export class GetProductsDto {
  @IsArray()
  @IsString({ each: true })
  productIds: string[];
}
