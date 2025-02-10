import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { hash } from 'bcrypt';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private readonly userRepository: Repository<User>) {}

  async create(dto: CreateUserDto) {
    const { email, password } = dto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (user) {
      throw new BadRequestException('이미 존재하는 이메일입니다.');
    }

    const hashedPassword = await hash(password, 10);

    await this.userRepository.save({ ...dto, password: hashedPassword });

    return this.userRepository.findOne({ where: { email } });
  }

  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('존재하지 않는 유저입니다.');
    }

    return user;
  }
}
