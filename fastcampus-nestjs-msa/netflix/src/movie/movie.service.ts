import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Movie } from './entities/movie.entity';
import { Repository } from 'typeorm';

@Injectable()
export class MovieService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  async getManyMovies() {
    return this.movieRepository.find();
  }

  async getMovieById(id: number) {
    const movie = await this.movieRepository.findOne({ where: { id } });

    if (!movie) {
      throw new NotFoundException(`Movie with id ${id} not found`);
    }

    return movie;
  }

  async create(createMovieDto: CreateMovieDto) {
    const movie = this.movieRepository.create(createMovieDto);
    return this.movieRepository.save(movie);
  }

  async update(id: number, updateMovieDto: UpdateMovieDto) {
    const movie = await this.getMovieById(id);
    movie.title = updateMovieDto.title;
    movie.genre = updateMovieDto.genre;
    return this.movieRepository.save(movie);
  }

  async remove(id: number) {
    const movie = await this.getMovieById(id);
    return this.movieRepository.remove(movie);
  }
}
