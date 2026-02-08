import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Client can send token in auth object or headers
      const token =
        client.handshake.auth.token || client.handshake.headers.authorization;
        
      if (!token) {
        client.disconnect();
        return;
      }

      // Remove Bearer if present
      const cleanToken = token.replace('Bearer ', '');
      
      const payload = this.jwtService.verify(cleanToken, {
        secret: process.env.JWT_SECRET,
      });

      // Join the user to their own room
      const roomName = `user_${payload.sub}`;
      await client.join(roomName);
      
      console.log(`Client connected: ${client.id} joined ${roomName}`);
    } catch (e) {
      console.log('Socket Connection Failed:', e);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user_${userId}`).emit(event, data);
  }
}
