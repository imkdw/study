import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as ffmpeg from '@ffmpeg-installer/ffmpeg';
import * as ffmpegFluent from 'fluent-ffmpeg';
import * as ffprobe from 'ffprobe-static';
import session from 'express-session';

ffmpegFluent.setFfmpegPath(ffmpeg.path);
ffmpegFluent.setFfprobePath(ffprobe.path);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'verbose', 'debug'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true // 암묵적 형변환
      }
    }),
  );

  app.use(
    session({
      secret: 'secret',
    }),
  );

  await app.listen(process.env.PORT);
}
bootstrap();
