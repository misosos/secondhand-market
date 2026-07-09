import "reflect-metadata";
import cookieParser from "cookie-parser";
import { NestFactory, Reflector } from "@nestjs/core";
import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { RedisIoAdapter } from "./infra/redis/redis-io.adapter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });

  // Auth tokens live in httpOnly cookies (see AuthController) — needed to
  // read them back off incoming requests. CSRF checking (CsrfGuard) is
  // registered as a global Nest guard instead of Express middleware so its
  // rejections flow through the normal exception filter.
  app.use(cookieParser());

  // Strips unknown fields and coerces primitives so every module can trust
  // its DTOs without re-validating in the service layer.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Honors @Exclude() on entities/DTOs (e.g. User.password) at the response
  // boundary, so sensitive fields can't leak just because a service forgot
  // to manually strip them.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.setGlobalPrefix("api");

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
}

bootstrap();
