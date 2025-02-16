import { Body, Controller, Post, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { OrderService } from './order.service';
import { Authorization } from '../../../gateway/src/auth/decorator/authorization.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { EventPattern, Transport } from '@nestjs/microservices';
import { Payload } from '@nestjs/microservices';
import { DeliveryStartedDto } from './dto/delivery-started.dto';
import { RpcInterceptor } from '@app/common';
import { OrderStatus } from './entity/order.entity';
import { CreateOrderUseCase } from '../../usecase/create-order.usecase';

@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly createOrderUseCase: CreateOrderUseCase,
  ) {}

  @Post()
  @UsePipes(ValidationPipe)
  async createOrder(@Authorization() token: string, @Body() body: CreateOrderDto) {
    return this.createOrderUseCase.execute(body);
  }

  @EventPattern({ cmd: 'delivery_started', transport: Transport.TCP })
  @UsePipes(ValidationPipe)
  @UseInterceptors(RpcInterceptor)
  async deliveryStarted(@Payload() payload: DeliveryStartedDto) {
    // return this.orderService.changeOrderStatus(payload.orderId, OrderStatus.DELIVERY_STARTED);
  }
}
