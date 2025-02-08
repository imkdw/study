import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class ChatService {
  private readonly connectedClients = new Map<string, Socket>();

  registerClient(clientId: string, socket: Socket) {
    this.connectedClients.set(clientId, socket);
  }

  removeClient(clientId: string) {
    this.connectedClients.delete(clientId);
  }
}
