import { IsString } from 'class-validator';

export class GetUserInfoDto {
  @IsString()
  userId: string;
}
