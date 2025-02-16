import { InjectRepository } from '@nestjs/typeorm';
import { PaymentModel } from 'apps/payment/src/domain/payment.domain';
import { DatabaseOutputPort } from 'apps/payment/src/port/output/database.port';
import { Repository } from 'typeorm';
import { PaymentEntity } from './entity/payment.entity';
import { PaymentMapper } from './mapper/payment.mapper';

export class TypeOrmAdapter implements DatabaseOutputPort {
  constructor(@InjectRepository(PaymentEntity) private readonly paymentRepository: Repository<PaymentEntity>) {}

  async savePayment(payment: PaymentModel): Promise<PaymentModel> {
    const savedPayment = await this.paymentRepository.save(payment);
    return new PaymentMapper(savedPayment).toDomain();
  }

  async updatePayment(payment: PaymentModel): Promise<PaymentModel> {
    await this.paymentRepository.update(payment.id, payment);
    const result = await this.paymentRepository.findOneBy({ id: payment.id });
    return new PaymentMapper(result).toDomain();
  }
}
