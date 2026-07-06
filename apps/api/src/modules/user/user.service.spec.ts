import { Test } from "@nestjs/testing";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AccountStatus } from "@prisma/client";
import { UserService } from "./user.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { RedisService } from "../../infra/redis/redis.service";

jest.mock("bcrypt");

describe("UserService", () => {
  let service: UserService;
  let prisma: { user: { findFirst: jest.Mock; update: jest.Mock } };
  let redisClient: { del: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findFirst: jest.fn(), update: jest.fn() } };
    redisClient = { del: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { client: redisClient } },
      ],
    }).compile();

    service = module.get(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("toPublicUser", () => {
    it("never includes the password hash in the mapped shape", () => {
      const user = {
        id: "u1",
        username: "alice",
        password: "super-secret-hash",
        bio: "hi",
        status: AccountStatus.ACTIVE,
        reportCount: 0,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const publicUser = service.toPublicUser(user as any);

      expect(publicUser).not.toHaveProperty("password");
      expect(publicUser).toEqual({
        id: "u1",
        username: "alice",
        bio: "hi",
        status: AccountStatus.ACTIVE,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });
  });

  describe("getPublicProfile", () => {
    it("throws NotFoundException for a missing or soft-deleted user", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getPublicProfile("ghost")).rejects.toThrow(NotFoundException);
    });
  });

  describe("changePassword", () => {
    const existingUser = {
      id: "u1",
      username: "alice",
      password: "old-hash",
      bio: null,
      status: AccountStatus.ACTIVE,
      createdAt: new Date(),
    };

    it("throws NotFoundException when the user no longer exists", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.changePassword("u1", { currentPassword: "old", newPassword: "newpassword123" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects an incorrect current password without touching the row", async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword("u1", { currentPassword: "wrong", newPassword: "newpassword123" }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("hashes the new password and invalidates any existing refresh session", async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue("new-hash");

      await service.changePassword("u1", { currentPassword: "old", newPassword: "newpassword123" });

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { password: "new-hash" } });
      // Forces re-login on every other device/session, per the design
      // documented in auth.service.ts's refresh-token rotation.
      expect(redisClient.del).toHaveBeenCalledWith("refresh:u1");
    });
  });
});
