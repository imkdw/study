import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { THUMBNAIL_GENERATION } from './worker.const';
import { join } from 'path';
import { cwd } from 'process';
import * as ffmpegFluent from 'fluent-ffmpeg';
@Processor(THUMBNAIL_GENERATION)
export class ThumbnailGenerationWorker extends WorkerHost {
  async process(job: Job): Promise<any> {
    console.log(job.data);

    const { videoId, videoPath } = job.data;

    if (!videoId || !videoPath) {
      throw new Error('Required job data is missing: videoId and videoPath are required');
    }

    const outputDir = join(cwd(), 'public', 'thumbnail');
    const outputPath = join(outputDir, `${videoId}.png`);

    ffmpegFluent(videoPath)
      .screenshots({
        count: 1,
        folder: outputDir,
        filename: `${videoId}.png`,
        size: '320x240',
      })
      .on('end', () => {
        console.log(`Thumbnail generated: ${outputPath}`);
      })
      .on('error', (e: unknown) => {
        throw new Error(`Failed to generate thumbnail: ${e}`);
      });
    return 0;
  }
}
