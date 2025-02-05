import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDirectorDto } from './dto/create-director.dto';
import { UpdateDirectorDto } from './dto/update-director.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Director } from './entitiy/director.entity';

@Injectable()
export class DirectorService {
  constructor(@InjectRepository(Director) private directorRepository: Repository<Director>) {}

  async create(createDirectorDto: CreateDirectorDto) {
    return this.directorRepository.save(createDirectorDto);
  }

  async findAll() {
    return this.directorRepository.find();
  }

  async findOne(id: number) {
    return this.directorRepository.findOne({
      where: { id },
    });
  }

  async update(id: number, updateDirectorDto: UpdateDirectorDto) {
    const director = await this.directorRepository.findOne({ where: { id } });
    if (!director) {
      throw new NotFoundException(`Director with ID ${id} not found`);
    }

    return this.directorRepository.update(id, updateDirectorDto);
  }

  async remove(id: number) {
    const director = await this.directorRepository.findOne({ where: { id } });
    if (!director) {
      throw new NotFoundException(`Director with ID ${id} not found`);
    }

    return this.directorRepository.delete(id);
  }
}
