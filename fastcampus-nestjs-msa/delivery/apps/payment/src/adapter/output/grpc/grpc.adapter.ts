import { OnModuleInit } from '@nestjs/common';
import { NetworkOutputPort } from 'apps/payment/src/port/output/network.port';
import { lastValueFrom } from 'rxjs';

export class GrpcAdapter implements NetworkOutputPort, OnModuleInit {
  constructor(private readonly notificationService: any) {}

  onModuleInit() {
    this.notificationService = this.notificationService.getService<any>('NotificationService');
  }

  async sendNotification(orderId: string, to: string): Promise<void> {
    await lastValueFrom(
      this.notificationService.sendPaymentNotification({
        orderId,
        to,
      }),
    );
  }
}
