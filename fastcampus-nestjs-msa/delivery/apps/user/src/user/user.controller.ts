import { Controller, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { UserService } from './user.service';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { RpcInterceptor } from '../../../../libs/common/src/interceptor';
import { GetUserInfoDto } from './dto/get-user-info.dto';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern({ cmd: 'get_user_info', transport: Transport.TCP })
  @UseInterceptors(RpcInterceptor)
  @UsePipes(ValidationPipe)
  getUserInfo(@Payload() dto: GetUserInfoDto) {
    return this.userService.getUserById(dto.userId);
  }
}
