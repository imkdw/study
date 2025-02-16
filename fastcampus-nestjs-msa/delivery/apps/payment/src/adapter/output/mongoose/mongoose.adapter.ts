import { DatabaseOutputPort } from 'apps/payment/src/port/output/database.port';
import { PaymentModel } from 'apps/payment/src/domain/payment.domain';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentDocument } from './document/payment.document';
import { PaymentDocumentMapper } from './mapper/payment-document.mapper';
export class MongooseAdapter implements DatabaseOutputPort {
  constructor(@InjectModel(PaymentDocument.name) private readonly paymentModel: Model<PaymentDocument>) {}

  async savePayment(payment: PaymentModel): Promise<PaymentModel> {
    const savedPayment = await this.paymentModel.create(payment);
    return new PaymentDocumentMapper(savedPayment).toDomain();
  }

  async updatePayment(payment: PaymentModel): Promise<PaymentModel> {
    const updatedPayment = await this.paymentModel.findByIdAndUpdate(payment.id, payment, { new: true });
    return new PaymentDocumentMapper(updatedPayment).toDomain();
  }
}
