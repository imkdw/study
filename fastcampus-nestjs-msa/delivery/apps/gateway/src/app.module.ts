import { Module } from '@nestjs/common';
import { OrderModule } from './order/order.module';
import { ProductModule } from './product/product.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ORDER_SERVICE, PRODUCT_SERVICE, USER_SERVICE } from '../../../libs/common/src';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    OrderModule,
    ProductModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        HTTP_PORT: Joi.number().required(),
        USER_HOST: Joi.string().required(),
        USER_TCP_PORT: Joi.number().required(),
        PRODUCT_HOST: Joi.string().required(),
        PRODUCT_TCP_PORT: Joi.number().required(),
        ORDER_HOST: Joi.string().required(),
        ORDER_TCP_PORT: Joi.number().required(),
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: USER_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.getOrThrow<string>('USER_HOST'),
            port: configService.getOrThrow<number>('USER_TCP_PORT'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: PRODUCT_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.getOrThrow<string>('PRODUCT_HOST'),
            port: configService.getOrThrow<number>('PRODUCT_TCP_PORT'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: ORDER_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.getOrThrow<string>('ORDER_HOST'),
            port: configService.getOrThrow<number>('ORDER_TCP_PORT'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
