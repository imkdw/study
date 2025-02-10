import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  KAKAO = 'KAKAO',
}

@Schema({ _id: false })
export class Payment extends Document {
  @Prop()
  paymentId: string;

  @Prop({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Prop({ required: true })
  paymentName: string;

  @Prop({ required: true })
  amount: number;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
