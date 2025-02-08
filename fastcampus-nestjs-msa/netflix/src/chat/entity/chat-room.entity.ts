import { Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTable } from '../../common/entity/base.table';
import { User } from '../../user/entities/user.entity';
import { Chat } from './chat.entity';

@Entity()
export class ChatRoom extends BaseTable {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => User, (user) => user.chatRooms)
  @JoinTable()
  users: User[];

  @OneToMany(() => Chat, (chat) => chat.chatRoom)
  chats: Chat[];
}
