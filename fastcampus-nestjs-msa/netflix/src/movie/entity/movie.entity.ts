import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseTable } from '../../common/entity/base.table';
import { MovieDetail } from './movie-detail.entity';
import { Director } from '../../director/entitiy/director.entity';
import { Genre } from '../../genre/entities/genre.entity';

@Entity()
export class Movie extends BaseTable {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  title: string;

  @OneToOne(() => MovieDetail, (movieDetail) => movieDetail.id, { cascade: true, nullable: false })
  @JoinColumn()
  detail: MovieDetail;

  @ManyToOne(() => Director, (director) => director.movies, { cascade: true, nullable: false })
  director: Director;

  @ManyToMany(() => Genre, (genre) => genre.movies)
  @JoinTable()
  genre: Genre[];
}
