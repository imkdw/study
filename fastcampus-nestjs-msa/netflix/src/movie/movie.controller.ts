import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { MovieService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { MovieTitleValidationPipe } from './pipe/movie-title-validation.pipe';
import { Request } from 'express';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';

@Controller('movie')
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @Post()
  @UseInterceptors(TransactionInterceptor)
  create(@Body() createMovieDto: CreateMovieDto, @Req() req: any) {
    return this.movieService.create(createMovieDto, req.queryRunner);
  }

  @Get()
  async findAll(@Query('title', MovieTitleValidationPipe) title?: string) {
    return this.movieService.findAll(title);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: string, @Req() req: Request) {
    console.log(req.session);
    return this.movieService.getMovieById(+id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateMovieDto: UpdateMovieDto) {
    return this.movieService.update(+id, updateMovieDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.movieService.deleteMovie(+id);
  }
}
