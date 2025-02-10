import { PaymentService } from './payment.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcInterceptor } from '../../../../libs/common/src/interceptor';
import { MakePaymentDto } from './dto/make-payment.dto';
import { Controller, ValidationPipe } from '@nestjs/common';
import { UseInterceptors } from '@nestjs/common';
import { UsePipes } from '@nestjs/common';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @MessagePattern({ cmd: 'make_payment' })
  @UsePipes(ValidationPipe)
  @UseInterceptors(RpcInterceptor)
  async makePayment(@Payload() dto: MakePaymentDto) {
    return this.paymentService.makePayment(dto);
  }
}
