import { Injectable } from '@nestjs/common';
import Activity from '../../../../domain/activity.js';
import { ActivityPrismaEntity } from '../entities/activity-prisma.entity.js';

@Injectable()
export default class ActivityMapper {
  static mapToPrismaEntity(activity: Activity): ActivityPrismaEntity {
    return {} as ActivityPrismaEntity;
  }
}
