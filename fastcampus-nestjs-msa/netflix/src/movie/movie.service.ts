import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Movie } from './entity/movie.entity';
import { Like, Repository } from 'typeorm';
import { MovieDetail } from './entity/movie-detail.entity';
import { Director } from '../director/entitiy/director.entity';

@Injectable()
export class MovieService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(MovieDetail)
    private readonly movieDetailRepository: Repository<MovieDetail>,
    @InjectRepository(Director)
    private readonly directorRepository: Repository<Director>,
  ) {}

  async getManyMovies(title?: string) {
    if (!title) {
      return [await this.movieRepository.find(), await this.movieRepository.count()];
    }

    return this.movieRepository.findAndCount({
      where: {
        title: Like(`%${title}%`),
      },
    });
  }

  async getMovieById(id: number) {
    const movie = await this.movieRepository.findOne({
      where: { id },
      relations: ['detail'],
    });

    if (!movie) {
      throw new NotFoundException(`Movie with id ${id} not found`);
    }
    return movie;
  }

  async create(dto: CreateMovieDto) {
    const movie = this.movieRepository.create({
      title: dto.title,
      genre: dto.genre,
      detail: {
        detail: dto.detail,
      },
    });

    return this.movieRepository.save(movie);
  }

  async update(id: number, dto: UpdateMovieDto) {
    const movie = await this.getMovieById(id);
    if (!movie) {
      throw new NotFoundException(`Movie with id ${id} not found`);
    }

    const { detail, genre, title } = dto;
    if (detail) {
      await this.movieDetailRepository.update({ id: movie.detail.id }, { detail });
    }

    return this.movieRepository.update({ id }, { genre, title });
  }

  async deleteMovie(id: number) {
    const movie = await this.movieRepository.findOne({ where: { id }, relations: ['detail'] });
    if (!movie) {
      throw new NotFoundException(`Movie with id ${id} not found`);
    }

    await this.movieRepository.remove(movie);
    await this.movieDetailRepository.remove(movie.detail);
  }
}
