import { Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTable } from '../../common/entity/base.table';
import { User } from '../../user/entities/user.entity';
import { ChatRoom } from './chat-room.entity';

@Entity()
export class Chat extends BaseTable {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.chats)
  author: User;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.chats)
  chatRoom: ChatRoom;
}
