import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum PaymentStatus {
  PENDING,
  REJECTED,
  APPROVED,
}

export enum PaymentMethod {
  CREDIT_CARD,
  KAKAO,
}

export enum NotificationStatus {
  PENDING,
  SENT,
}

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
