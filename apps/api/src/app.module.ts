import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { validateEnv } from "./config/env.validation";
import { InfraModule } from "./infra/infra.module";
import { RedisModule } from "./infra/redis/redis.module";
import { RedisThrottlerStorage } from "./infra/redis/redis-throttler.storage";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { ProductModule } from "./modules/product/product.module";
import { ReportModule } from "./modules/report/report.module";
import { ChatModule } from "./modules/chat/chat.module";
import { AdminModule } from "./modules/admin/admin.module";
import { TransactionModule } from "./modules/transaction/transaction.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validate: validateEnv,
    }),
    InfraModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (config: ConfigService, storage: RedisThrottlerStorage) => ({
        throttlers: [
          {
            ttl: config.get<number>("THROTTLE_TTL_MS")!,
            limit: config.get<number>("THROTTLE_LIMIT")!,
          },
        ],
        storage,
      }),
    }),
    AuthModule,
    UserModule,
    ProductModule,
    ReportModule,
    ChatModule,
    AdminModule,
    TransactionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
