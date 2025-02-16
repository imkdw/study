import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';
import { NotificationStatus, PaymentMethod, PaymentStatus } from '../../../../domain/payment.domain';

@Schema()
export class PaymentDocument extends Document<ObjectId> {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  userEmail: string;

  @Prop({ required: true })
  paymentStatus: PaymentStatus;

  @Prop({ required: true })
  paymentMethod: PaymentMethod;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  cardNumber: string;

  @Prop({ required: true })
  expiryYear: string;

  @Prop({ required: true })
  expiryMonth: string;

  @Prop({ required: true })
  birthOrRegistration: string;

  @Prop({ required: true })
  passwordTwoDigits: string;

  @Prop({ required: true })
  notificationStatus: NotificationStatus;
}

export const PaymentSchema = SchemaFactory.createForClass(PaymentDocument);
