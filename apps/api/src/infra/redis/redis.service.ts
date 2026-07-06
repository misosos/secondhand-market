import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

// Wrapped rather than subclassed so feature modules (chat rate limiting,
// product list caching, the Socket.io Redis adapter) all share one
// connection via `client`, instead of each opening its own.
@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis(configService.get<string>("REDIS_URL")!);
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
