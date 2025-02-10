import { Inject, Injectable } from '@nestjs/common';
import { SendPaymentNotificationDto } from './dto/send-notification.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Notification, NotificationStatus } from './entity/notification.entity';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { ORDER_SERVICE } from '@app/common';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
    @Inject(ORDER_SERVICE) private readonly orderService: ClientProxy,
  ) {}

  async sendPaymentNotification(payload: SendPaymentNotificationDto) {
    const notification = await this.createNotification(payload.to);
    await this.sendEmail();
    await this.updateNotificationStatus(notification._id.toString(), NotificationStatus.SENT);
    this.sendDeliveryStartedMessage(payload.orderId);
    return this.notificationModel.findById(notification._id);
  }

  async createNotification(to: string): Promise<Notification> {
    return this.notificationModel.create({
      to,
      subject: 'Payment Notification',
      content: 'Payment successful',
    });
  }

  async sendEmail() {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async updateNotificationStatus(notificationId: string, status: NotificationStatus) {
    await this.notificationModel.findByIdAndUpdate(notificationId, { status });
  }

  async sendDeliveryStartedMessage(orderId: string) {
    this.orderService.send({ cmd: 'delivery_started' }, { orderId });
  }
}
