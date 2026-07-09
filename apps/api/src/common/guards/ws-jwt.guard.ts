import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { ACCESS_TOKEN_COOKIE } from "../../modules/auth/auth.constants";

// Minimal parse — we only ever need one named value out of the raw
// `Cookie` header, so pulling in a full cookie-parsing library for the WS
// handshake (which isn't run through Express's cookie-parser middleware)
// isn't worth it.
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

// Cookie first (browsers send it automatically on the handshake — see
// AuthController for how it's set), then handshake.auth/header as a
// fallback for non-browser socket.io clients (tests, scripts) that can't
// hold a cookie jar.
export function extractTokenFromSocket(client: Socket): string | null {
  const cookieToken = readCookie(client.handshake.headers.cookie, ACCESS_TOKEN_COOKIE);
  if (cookieToken) return cookieToken;

  const authToken = client.handshake.auth?.token as string | undefined;
  if (authToken) return authToken;

  const header = client.handshake.headers.authorization;
  const [type, token] = header?.split(" ") ?? [];
  return type === "Bearer" && token ? token : null;
}

// Socket.io equivalent of JwtAuthGuard: verifies the token from the
// handshake (cookie, or auth/header for non-browser clients) and stashes
// the payload on `socket.data.user`.
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
