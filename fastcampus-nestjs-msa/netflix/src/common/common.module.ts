import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { BullModule } from '@nestjs/bullmq';
import { CommonController } from './common.controller';
import { THUMBNAIL_GENERATION } from '../worker/worker.const';
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: THUMBNAIL_GENERATION,
    }),
  ],

  controllers: [CommonController],
  providers: [CommonService],
})
export class CommonModule {}
