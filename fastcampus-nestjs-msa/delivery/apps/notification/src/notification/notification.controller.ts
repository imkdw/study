import { Transport } from '@nestjs/microservices';
import { Payload } from '@nestjs/microservices';
import { MessagePattern } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { Controller } from '@nestjs/common';
import { SendPaymentNotificationDto } from './dto/send-notification.dto';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @MessagePattern({ cmd: 'send_payment_notification', transport: Transport.TCP })
  sendPaymentNotification(@Payload() payload: SendPaymentNotificationDto) {
    return this.notificationService.sendPaymentNotification(payload);
  }
}
