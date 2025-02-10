import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: 3001,
      retryAttempts: 5,
      retryDelay: 3000,
    },
  });

  await app.startAllMicroservices();

  await app.listen(process.env.HTTP_PORT);
}
bootstrap();
