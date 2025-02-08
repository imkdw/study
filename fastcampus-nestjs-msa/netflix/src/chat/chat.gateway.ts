import { Controller } from '@nestjs/common';
import { ChatService } from './chat.service';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

@WebSocketGateway(80, { namespace: 'chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    // 연결 검증
    this.chatService.registerClient(client.id, client);
  }

  handleDisconnect(client: Socket) {
    return;
  }

  @SubscribeMessage('message')
  async receiveMessage(@MessageBody() data: { message: string }, @ConnectedSocket() client: Socket) {
    console.log('receiveMessage', data);
    client.emit('message', data);
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(@MessageBody() data: { message: string }, @ConnectedSocket() client: Socket) {
    console.log('sendMessage', data);
    client.emit('message', data);
  }
}
