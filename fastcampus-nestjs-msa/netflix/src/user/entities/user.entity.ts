import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTable } from '../../common/entity/base.table';
import { Chat } from '../../chat/entity/chat.entity';
import { ChatRoom } from '../../chat/entity/chat-room.entity';

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

  @OneToMany(() => Chat, (chat) => chat.author)
  chats: Chat[];

  @OneToMany(() => ChatRoom, (chatRoom) => chatRoom.users)
  chatRooms: ChatRoom[];
}
