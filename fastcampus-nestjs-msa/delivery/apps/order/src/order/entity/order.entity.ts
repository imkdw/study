import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Customer, CustomerSchema } from './customer.entity';
import { Product, ProductSchema } from './product.entity';
import { DeliveryAddress, DeliveryAddressSchema } from './delivery-address.entity';
import { Payment, PaymentSchema } from './payment.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAYMENT_CANCELED = 'PAYMENT_CANCELED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
  DELIVERY_STARTED = 'DELIVERY_STARTED',
  DELIVERY_DONE = 'DELIVERY_DONE',
}

@Schema()
export class Order extends Document {
  @Prop({ required: true, type: CustomerSchema })
  customer: Customer;

  @Prop({ required: true, type: [ProductSchema] })
  products: Product[];

  @Prop({ required: true, type: DeliveryAddressSchema })
  deliveryAddress: DeliveryAddress;

  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop({ required: true, type: PaymentSchema })
  payment: Payment;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
