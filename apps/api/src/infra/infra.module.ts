import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { StorageModule } from "./storage/storage.module";

// Global so every feature module can inject PrismaService/RedisService/
// StorageService without re-importing this module each time.
@Global()
@Module({
  imports: [PrismaModule, RedisModule, StorageModule],
  exports: [PrismaModule, RedisModule, StorageModule],
})
export class InfraModule {}
