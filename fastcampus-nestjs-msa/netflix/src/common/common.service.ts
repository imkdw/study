import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, UploadedFile } from '@nestjs/common';
import { Queue } from 'bullmq';
import { THUMBNAIL_GENERATION } from '../worker/worker.const';

@Injectable()
export class CommonService {
  constructor(
    @InjectQueue(THUMBNAIL_GENERATION)
    private readonly thumbnailQueue: Queue,
  ) {}

  async createVideo(@UploadedFile() movie: Express.Multer.File) {
    console.log('movie.filename', movie.filename);
    console.log('movie.path', movie.path);

    await this.thumbnailQueue.add(THUMBNAIL_GENERATION, {
      videoId: movie.originalname,
    });
  }
}
