import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmAdapter } from '../adapter/output/typeorm/typeorm.adapter';
import { PortOneAdapter } from '../adapter/output/portone/portone.adapter';
import { GrpcAdapter } from '../adapter/output/grpc/grpc.adapter';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentSchema } from '../adapter/output/mongoose/document/payment.document';
import { PaymentDocument } from '../adapter/output/mongoose/document/payment.document';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        HTTP_PORT: Joi.number().required(),
        DB_URL: Joi.string().required(),
      }),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow('DB_URL'),
        autoLoadEntities: true,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow('DB_URL'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: PaymentDocument.name, schema: PaymentSchema }]),
  ],
  controllers: [PaymentController],
  providers: [
    {
      provide: 'DATABASE_OUTPUT_PORT',
      useClass: TypeOrmAdapter,
    },
    {
      provide: 'PAYMENT_OUTPUT_PORT',
      useClass: PortOneAdapter,
    },
    {
      provide: 'NETWORK_OUTPUT_PORT',
      useClass: GrpcAdapter,
    },
  ],
})
export class PaymentModule {}
