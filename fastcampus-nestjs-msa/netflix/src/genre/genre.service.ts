import { Injectable } from '@nestjs/common';
import { CreateGenreDto } from './dto/create-genre.dto';
import { UpdateGenreDto } from './dto/update-genre.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Genre } from './entities/genre.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GenreService {
  constructor(@InjectRepository(Genre) private genreRepository: Repository<Genre>) {}

  create(createGenreDto: CreateGenreDto) {
    return this.genreRepository.save(createGenreDto);
  }

  findAll() {
    return this.genreRepository.find();
  }

  findOne(id: number) {
    return this.genreRepository.findOne({ where: { id } });
  }

  async update(id: number, updateGenreDto: UpdateGenreDto) {
    const genre = await this.genreRepository.findOne({ where: { id } });

    if (!genre) {
      throw new Error('Genre not found');
    }

    return this.genreRepository.update(id, updateGenreDto);
  }

  remove(id: number) {
    const genre = this.genreRepository.findOne({ where: { id } });

    if (!genre) {
      throw new Error('Genre not found');
    }

    return this.genreRepository.delete(id);
  }
}
