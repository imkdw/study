import { Module } from '@nestjs/common';
import { ThumbnailGenerationWorker } from './thumbnail-generation.worker';

@Module({
  providers: [ThumbnailGenerationWorker],
})
export class WorkerModule {}
