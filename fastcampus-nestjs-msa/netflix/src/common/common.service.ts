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
    await this.thumbnailQueue.add(
      THUMBNAIL_GENERATION,
      {
        videoId: movie.filename.split('.')[0],
        videoPath: movie.path,
      },
      {
        priority: 1, // 우선순위
        delay: 100, // 작업 전 지연시간
        attempts: 3, // 실패시 최대 시도 횟수,
        lifo: true, // 스택구조로 나중에 추가된게 먼저 작업됨,
        removeOnComplete: true, // 작업 완료 후 삭제
        removeOnFail: true, // 작업 실패 후 삭제
      },
    );
  }
}
