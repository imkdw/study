import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTable } from '../../common/entity/base.table';

export enum Role {
  ADMIN,
  PAID_USER,
  USER,
}

@Entity()
export class User extends BaseTable {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ enum: Role, default: Role.USER })
  role: Role;
}
