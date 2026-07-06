import { UseFilters, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { CHAT_EVENTS } from "@secondhand/types";
import type { Server, Socket } from "socket.io";
import { extractTokenFromSocket, WsJwtGuard } from "../../common/guards/ws-jwt.guard";
import { WsExceptionsFilter } from "../../common/filters/ws-exceptions.filter";
import { JwtPayload } from "../../common/interfaces/jwt-payload.interface";
import { ChatService } from "./chat.service";
import { ChatHistoryQueryDto } from "./dto/chat-history-query.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { SendMessageDto } from "./dto/send-message.dto";

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:3000", credentials: true },
})
@UseGuards(WsJwtGuard)
// The app-level ValidationPipe registered in main.ts is bound to the HTTP
// adapter and does not reach WS message handlers, so DTO validation AND
// class-transformer's @Transform (e.g. SanitizeHtml on message content)
// silently never ran without this — confirmed by testing an XSS payload
// through chat:send and seeing it come back unstripped.
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@UseFilters(WsExceptionsFilter)
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Eager check at connection time per spec ("연결 시 JWT 검증"): reject
  // bad/missing tokens immediately instead of waiting for the first
  // message. WsJwtGuard (applied above) re-verifies on every message too,
  // since a 15m access token can expire mid-session on a long-lived socket.
  handleConnection(client: Socket) {
    const token = extractTokenFromSocket(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage(CHAT_EVENTS.JOIN_ROOM)
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() dto: JoinRoomDto) {
    const userId = this.userId(client);
    const room = await this.chatService.getOrCreateDmRoom(userId, dto.peerId);
    await client.join(room.id);
    return room;
  }

  @SubscribeMessage(CHAT_EVENTS.JOIN_GLOBAL)
  async handleJoinGlobal(@ConnectedSocket() client: Socket) {
    const room = await this.chatService.getGlobalRoom(this.userId(client));
    await client.join(room.id);
    return room;
  }

  @SubscribeMessage(CHAT_EVENTS.SEND_MESSAGE)
  async handleSend(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
    const userId = this.userId(client);
    const message = await this.chatService.sendMessage(userId, dto.roomId, dto.content);

    // Persist-then-broadcast per spec: the message only reaches sockets
    // that already joined this room's Socket.io room (see handleJoin), so
    // non-participants can never receive it even if they guessed a roomId.
    this.server.to(dto.roomId).emit(CHAT_EVENTS.NEW_MESSAGE, message);

    return message;
  }

  @SubscribeMessage(CHAT_EVENTS.REQUEST_HISTORY)
  handleHistory(@ConnectedSocket() client: Socket, @MessageBody() dto: ChatHistoryQueryDto) {
    const userId = this.userId(client);
    return this.chatService.getHistory(userId, dto);
  }

  @SubscribeMessage(CHAT_EVENTS.LIST_ROOMS)
  handleListRooms(@ConnectedSocket() client: Socket) {
    return this.chatService.listRooms(this.userId(client));
  }

  private userId(client: Socket): string {
    return (client.data.user as JwtPayload).sub;
  }
}
