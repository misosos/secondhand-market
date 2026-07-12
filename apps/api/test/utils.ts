import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { RedisService } from "../src/infra/redis/redis.service";

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  // Mirrors main.ts's bootstrap() — APP_GUARD/APP_FILTER entries are already
  // active via DI, but the imperatively-applied pipe/prefix aren't.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix("api");
  await app.init();
  return app;
}

export async function cleanDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.report.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chatRoom.deleteMany({ where: { isGlobal: false } });
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
}

export async function flushRedis(app: INestApplication): Promise<void> {
  const redis = app.get(RedisService);
  await redis.client.flushdb();
}

export async function backdateUser(app: INestApplication, username: string, msAgo: number): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.user.update({ where: { username }, data: { createdAt: new Date(Date.now() - msAgo) } });
}
