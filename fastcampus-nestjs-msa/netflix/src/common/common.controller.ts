import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { CommonService } from './common.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v7 } from 'uuid';

@Controller('common')
export class CommonController {
  constructor(private readonly commonService: CommonService) {}

  @Post('video')
  @UseInterceptors(
    FileInterceptor('movie', {
      storage: diskStorage({
        destination: './upload',
        filename: (req, file, callback) => {
          const uniqueSuffix = v7();
          callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async createVideo(@UploadedFile() movie: Express.Multer.File) {
    await this.commonService.createVideo(movie);
  }
}
