import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { CommonService } from './common.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('common')
export class CommonController {
  constructor(private readonly commonService: CommonService) {}

  @Post('video')
  @UseInterceptors(FileInterceptor('movie'))
  async createVideo(@UploadedFile() movie: Express.Multer.File) {
    console.log('movie', movie);

    await this.commonService.createVideo(movie);
  }
}
