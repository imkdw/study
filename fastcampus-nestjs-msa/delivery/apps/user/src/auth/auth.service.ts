import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { ResgisterDto } from './dto/resgister.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entity/user.entity';
import { Repository } from 'typeorm';
import { compare } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async register(rawToken: string, dto: ResgisterDto) {
    const { email, password } = this.parseBasicToken(rawToken);

    return this.userService.create({
      email,
      password,
      ...dto,
    });
  }

  async login(rawToken: string) {
    const { email, password } = this.parseBasicToken(rawToken);

    const user = await this.authenticate(email, password);

    return {
      accessToken: await this.issueToken(user, false),
      refreshToken: await this.issueToken(user, true),
    };
  }

  async issueToken(user: any, isRefreshToken: boolean) {
    const secret = isRefreshToken
      ? this.configService.getOrThrow('REFRESH_TOKEN_SECRET')
      : this.configService.getOrThrow('ACCESS_TOKEN_SECRET');

    return this.jwtService.signAsync(
      {
        sub: user.id,
        role: user.role,
        type: isRefreshToken ? 'refresh' : 'access',
      },
      { secret, expiresIn: '3600h' },
    );
  }

  async authenticate(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const passOk = await compare(password, user.password);

    if (!passOk) {
      throw new BadRequestException('Invalid credentials');
    }

    return user;
  }

  parseBasicToken(rawToken: string) {
    const basicSplit = rawToken.split(' ');

    if (basicSplit.length !== 2) {
      throw new BadRequestException('Invalid token');
    }

    const [basic, token] = basicSplit;

    if (basic.toLowerCase() !== 'basic') {
      throw new BadRequestException('Invalid token');
    }

    const decoded = Buffer.from(token, 'base64').toString('utf-8');

    const tokenSplit = decoded.split(':');

    if (tokenSplit.length !== 2) {
      throw new BadRequestException('Invalid token');
    }

    const [email, password] = tokenSplit;

    return { email, password };
  }

  async parseBearerToken(rawToken: string, isRefreshToken: boolean) {
    try {
      if (!rawToken) {
        throw new RpcException('Token is required');
      }

      const secret = isRefreshToken
        ? this.configService.getOrThrow('REFRESH_TOKEN_SECRET')
        : this.configService.getOrThrow('ACCESS_TOKEN_SECRET');

      const token = rawToken.split(' ')[1];

      const payload = await this.jwtService.verifyAsync(token, { secret });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new RpcException('User not found');
      }

      return user;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException('Invalid token');
    }
  }
}
