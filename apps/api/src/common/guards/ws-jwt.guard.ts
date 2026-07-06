import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

// Shared with ChatGateway.handleConnection, which does an eager check at
// connection time (disconnecting bad-token sockets immediately) — this
// guard then re-verifies per message so a token that expires mid-session
// (long-lived WS connections can outlive a 15m access token) stops working
// too, instead of only being checked once at handshake.
export function extractTokenFromSocket(client: Socket): string | null {
  const authToken = client.handshake.auth?.token as string | undefined;
  if (authToken) return authToken;

  const header = client.handshake.headers.authorization;
  const [type, token] = header?.split(" ") ?? [];
  return type === "Bearer" && token ? token : null;
}

// Socket.io equivalent of JwtAuthGuard: verifies the token from the
// handshake (not headers, since browsers can't set custom headers on the
// initial WS upgrade) and stashes the payload on `socket.data.user`.
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const token = extractTokenFromSocket(client);
    if (!token) {
      throw new WsException("Missing access token");
    }

    try {
      client.data.user = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      });
      return true;
    } catch {
      throw new WsException("Invalid or expired access token");
    }
  }
}
