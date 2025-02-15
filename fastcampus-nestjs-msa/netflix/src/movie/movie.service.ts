import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Movie } from './entity/movie.entity';
import { DataSource, In, Like, QueryRunner, Repository } from 'typeorm';
import { MovieDetail } from './entity/movie-detail.entity';
import { Director } from '../director/entitiy/director.entity';
import { Genre } from '../genre/entities/genre.entity';

@Injectable()
export class MovieService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(MovieDetail)
    private readonly movieDetailRepository: Repository<MovieDetail>,
    @InjectRepository(Director)
    private readonly directorRepository: Repository<Director>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(title?: string) {
    const qb = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.detail', 'detail')
      .leftJoinAndSelect('movie.director', 'director');

    if (title) {
      qb.where('movie.title like :title', { title: `%${title}%` });
    }

    const result = await qb.getMany();

    return result;
  }

  async getMovieById(id: number) {
    const movie = await this.movieRepository.findOne({
      where: { id },
      relations: ['detail', 'director'],
    });

    if (!movie) {
      throw new NotFoundException(`Movie with id ${id} not found`);
    }
    return movie;
  }

  async create(dto: CreateMovieDto, qr: QueryRunner) {
    try {
      const director = await qr.manager.findOne(Director, { where: { id: dto.directorId } });
      if (!director) {
        throw new NotFoundException(`Director with id ${dto.directorId} not found`);
      }

      const genres = await qr.manager.find(Genre, { where: { id: In(dto.genreIds) } });
      if (genres.length !== dto.genreIds.length) {
        throw new NotFoundException(`Genre with id ${dto.genreIds} not found`);
      }

      const movieDetail = await qr.manager.createQueryBuilder().insert().into(Movie);

      const movie = qr.manager.create(Movie, {
        title: dto.title,
        genre: genres,
        detail: {
          detail: dto.detail,
        },
        director,
      });

      const createdMovie = await qr.manager.save(Movie, movie);

      await qr.commitTransaction();

      return createdMovie;
    } catch (e) {
      throw e;
    }
  }

  async update(id: number, dto: UpdateMovieDto) {
    const movie = await this.getMovieById(id);
    if (!movie) {
      throw new NotFoundException(`Movie with id ${id} not found`);
    }

    const { detail, directorId, genreIds, ...movieRest } = dto;

    if (detail) {
      await this.movieDetailRepository.update({ id: movie.detail.id }, { detail });
    }

    let newDirector: Director | null;
    if (directorId) {
      const director = await this.directorRepository.findOne({ where: { id: directorId } });
      if (!director) {
        throw new NotFoundException(`Director with id ${directorId} not found`);
      }
      newDirector = director;
    }

    const genres = await this.genreRepository.find({ where: { id: In(genreIds) } });

    const movieUpdateFields = {
      ...movieRest,
      ...(newDirector && { director: newDirector }),
    };

    return this.movieRepository.update({ id }, movieUpdateFields);
  }

  async deleteMovie(id: number) {
    const movie = await this.movieRepository.findOne({ where: { id }, relations: ['detail', 'director'] });
    if (!movie) {
      throw new NotFoundException(`Movie with id ${id} not found`);
    }

    await this.movieRepository.remove(movie);
    await this.movieDetailRepository.remove(movie.detail);
  }
}
