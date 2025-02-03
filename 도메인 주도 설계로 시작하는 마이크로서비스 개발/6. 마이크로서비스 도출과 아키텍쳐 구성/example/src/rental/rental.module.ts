import { Module } from '@nestjs/common';
import { RentalResource } from './web.rest/rental.resource';

@Module({
  controllers: [RentalResource],
})
export class RentalModule {}
