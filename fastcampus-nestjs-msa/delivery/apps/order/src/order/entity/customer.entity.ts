import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class Customer {
  @Prop({ required: true })
  customerId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
