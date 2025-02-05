import { Module } from '@nestjs/common';
import { DirectorService } from './director.service';
import { DirectorController } from './director.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Director } from './entitiy/director.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Director])],
  controllers: [DirectorController],
  providers: [DirectorService],
})
export class DirectorModule {}
