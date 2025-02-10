import { Body, Controller, Post, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { OrderService } from './order.service';
import { Authorization } from '../../../user/src/auth/decorator/authorization.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { EventPattern, Transport } from '@nestjs/microservices';
import { Payload } from '@nestjs/microservices';
import { DeliveryStartedDto } from './dto/delivery-started.dto';
import { RpcInterceptor } from '@app/common';
import { OrderStatus } from './entity/order.entity';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UsePipes(ValidationPipe)
  async createOrder(@Authorization() token: string, @Body() body: CreateOrderDto) {
    return this.orderService.createOrder(body, token);
  }

  @EventPattern({ cmd: 'delivery_started', transport: Transport.TCP })
  @UsePipes(ValidationPipe)
  @UseInterceptors(RpcInterceptor)
  async deliveryStarted(@Payload() payload: DeliveryStartedDto) {
    console.log('deliveryStarted', payload);

    return this.orderService.changeOrderStatus(payload.orderId, OrderStatus.DELIVERY_STARTED);
  }
}
