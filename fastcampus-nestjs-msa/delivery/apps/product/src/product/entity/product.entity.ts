import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Column({ unique: true })
  name: string;

  @Column()
  price: number;

  @Column()
  description: string;

  @Column({ default: 0 })
  stock: number;
}
