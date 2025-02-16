// import { Inject, Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Payment, PaymentStatus } from './entity/payment.entity';
// import { Repository } from 'typeorm';
// import { MakePaymentDto } from './dto/make-payment.dto';
// import { NOTIFICATION_SERVICE } from '../../../../libs/common/src';
// import { ClientProxy } from '@nestjs/microservices';
// import { lastValueFrom } from 'rxjs';

// @Injectable()
// export class PaymentService {
//   constructor(
//     @InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>,
//     @Inject(NOTIFICATION_SERVICE) private readonly notificationService: ClientProxy,
//   ) {}

//   async makePayment(payload: MakePaymentDto) {
//     let paymentId: string;

//     try {
//       const result = await this.paymentRepository.save(payload);
//       paymentId = result.id;

//       await this.processPayment();

//       await this.updatePaymentStatus(paymentId, PaymentStatus.APPROVED);

//       this.sendNotification(payload.orderId, payload.userEmail);

//       return this.paymentRepository.findOne({ where: { id: paymentId } });
//     } catch {
//       await this.updatePaymentStatus(paymentId, PaymentStatus.REJECTED);
//     }
//   }

//   async processPayment() {
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//   }

//   async updatePaymentStatus(paymentId: string, status: PaymentStatus) {
//     await this.paymentRepository.update(paymentId, { paymentStatus: status });
//   }

//   private async sendNotification(orderId: string, userEmail: string) {
//     const response = await lastValueFrom(
//       this.notificationService.emit({ cmd: 'send_payment_notification' }, { orderId, userEmail }),
//     );

//     if (response.status === 'error') {
//       throw new Error('Failed to send notification');
//     }
//   }
// }
