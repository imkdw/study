import { NotificationStatus, PaymentMethod, PaymentStatus } from 'apps/payment/src/domain/payment.domain';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  userEmail: string;

  @Column({ enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @Column({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column()
  amount: number;

  @Column()
  cardNumber: string;

  @Column()
  expiryYear: string;

  @Column()
  expiryMonth: string;

  @Column()
  birthOrRegistration: string;

  @Column()
  passwordTwoDigits: string;

  @Column({ enum: NotificationStatus, default: NotificationStatus.PENDING })
  notificationStatus: NotificationStatus;
}
