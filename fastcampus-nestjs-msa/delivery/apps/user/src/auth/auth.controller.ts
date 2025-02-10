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
import { ResgisterDto } from './dto/resgister.dto';
import { Authorization } from './decorator/authorization.decorator';
import { MessagePattern, RpcException, Transport } from '@nestjs/microservices';
import { ParseBearerTokenDto } from './dto/parse-bearer-token.dto';
import { RpcInterceptor } from '../../../../libs/common/src/interceptor';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(ValidationPipe)
  registerUser(@Authorization() token: string, @Body() dto: ResgisterDto) {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    return this.authService.register(token, dto);
  }

  @Post('login')
  @UsePipes(ValidationPipe)
  async login(@Authorization() token: string) {
    return this.authService.login(token);
  }

  @MessagePattern({ cmd: 'parse_bearer_token', transport: Transport.TCP })
  @UseInterceptors(RpcInterceptor)
  async parseBearerToken(dto: ParseBearerTokenDto) {
    return await this.authService.parseBearerToken(dto.token, false);
  }
}
