import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { User } from "@prisma/client";
import type { AccountStatus, ChangePasswordRequest, PublicUser, Role, UpdateProfileRequest } from "@secondhand/types";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { RedisService } from "../../infra/redis/redis.service";
import { refreshTokenKey } from "../../common/utils/redis-keys";
import { BCRYPT_SALT_ROUNDS } from "../auth/auth.constants";

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  findActiveByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { username, deletedAt: null } });
  }

  findActiveById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async getPublicProfile(id: string): Promise<PublicUser> {
    const user = await this.findActiveById(id);
    if (!user) throw new NotFoundException("User not found");
    return this.toPublicUser(user);
  }

  async updateBio(userId: string, dto: UpdateProfileRequest): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { bio: dto.bio },
    });
    return this.toPublicUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordRequest): Promise<void> {
    const user = await this.findActiveById(userId);
    if (!user) throw new NotFoundException("User not found");

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) throw new UnauthorizedException("Current password is incorrect");

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { password: passwordHash } });

    // Password change invalidates any existing refresh token, forcing
    // re-login on every other device/session.
    await this.redisService.client.del(refreshTokenKey(userId));
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      bio: user.bio,
      // Prisma's generated AccountStatus enum and @secondhand/types's are
      // distinct TS types with identical string values at runtime.
      status: user.status as unknown as AccountStatus,
      role: user.role as unknown as Role,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
