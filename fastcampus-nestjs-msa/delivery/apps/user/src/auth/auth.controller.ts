import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/resgister.dto';
import { Authorization } from '../../../gateway/src/auth/decorator/authorization.decorator';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { ParseBearerTokenDto } from './dto/parse-bearer-token.dto';
import { RpcInterceptor } from '../../../../libs/common/src/interceptor';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(ValidationPipe)
  registerUser(@Authorization() token: string, @Body() dto: RegisterDto) {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    return this.authService.register(token, dto);
  }

  @MessagePattern({ cmd: 'parse_bearer_token', transport: Transport.TCP })
  @UseInterceptors(RpcInterceptor)
  async parseBearerToken(dto: ParseBearerTokenDto) {
    return await this.authService.parseBearerToken(dto.token, false);
  }

  @MessagePattern({ cmd: 'register' })
  register(@Payload() data: RegisterDto) {
    return this.authService.register(data.token, data);
  }

  @MessagePattern({ cmd: 'login' })
  login(@Payload() data: LoginDto) {
    return this.authService.login(data.token);
  }
}
