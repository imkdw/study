import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTable } from '../../common/entity/base.table';
import { MovieDetail } from './movie-detail.entity';
import { Director } from '../../director/entitiy/director.entity';

@Entity()
export class Movie extends BaseTable {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  genre: string;

  @OneToOne(() => MovieDetail, (movieDetail) => movieDetail.id, { cascade: true })
  @JoinColumn()
  detail: MovieDetail;

  @ManyToOne(() => Director, (director) => director.movies)
  director: Director;
}
