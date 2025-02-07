import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class MovieTitleValidationPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!value) {
      return value;
    }

    /**
     * 제목이 2글자 이하면 에러
     */
    if (value.length <= 2) {
      throw new BadRequestException('제목은 3글자 이상이어야 합니다.');
    }

    return value;
  }
}
