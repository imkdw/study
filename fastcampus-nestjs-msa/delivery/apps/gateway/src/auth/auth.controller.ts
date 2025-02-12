import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Authorization } from './decorator/authorization.decorator';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  registerUser(@Authorization() token: string, @Body() dto: RegisterDto) {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    return this.authService.register(token, dto);
  }

  // @Post('login')
  // async login(@Authorization() token: string) {
  //   return this.authService.login(token);
  // }
}
