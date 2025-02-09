import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { THUMBNAIL_GENERATION } from './worker.const';

@Processor(THUMBNAIL_GENERATION)
export class ThumbnailGenerationWorker extends WorkerHost {
  async process(job: Job, token?: string): Promise<any> {
    console.log('Job ID:', job.id);
    console.log('Job Name:', job.name);
    console.log('Job Data:', job.data);

    const { videoId, videoPath } = job.data;

    if (!videoId || !videoPath) {
      throw new Error('Required job data is missing: videoId and videoPath are required');
    }

    return 0;
  }
}
