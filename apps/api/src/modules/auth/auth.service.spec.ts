import { Test } from "@nestjs/testing";
import { ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHash } from "crypto";
import { AccountStatus } from "@prisma/client";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { RedisService } from "../../infra/redis/redis.service";
import { UserService } from "../user/user.service";
import { LOGIN_FAIL_THRESHOLD } from "./auth.constants";

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let prisma: { user: { create: jest.Mock } };
  let redisClient: { get: jest.Mock; set: jest.Mock; del: jest.Mock; exists: jest.Mock; incr: jest.Mock; pexpire: jest.Mock };
  let userService: {
    findActiveByUsername: jest.Mock;
    findActiveById: jest.Mock;
    toPublicUser: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock; decode: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { create: jest.fn() } };
    redisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn().mockResolvedValue(0),
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn(),
    };
    userService = {
      findActiveByUsername: jest.fn(),
      findActiveById: jest.fn(),
      toPublicUser: jest.fn((u) => ({
        id: u.id,
        username: u.username,
        bio: u.bio ?? null,
        status: u.status,
        createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
      })),
    };
    jwtService = { sign: jest.fn(), verify: jest.fn(), decode: jest.fn() };

    const configService = {
      get: jest.fn(
        (key: string) =>
          ({
            JWT_ACCESS_SECRET: "access-secret",
            JWT_REFRESH_SECRET: "refresh-secret",
            JWT_REFRESH_EXPIRES_IN: "7d",
          })[key],
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { client: redisClient } },
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("signup", () => {
    it("hashes the password before persisting and never stores the plaintext", async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-value");
      prisma.user.create.mockResolvedValue({
        id: "u1",
        username: "alice",
        password: "hashed-value",
        bio: null,
        status: AccountStatus.ACTIVE,
        createdAt: new Date(),
      });

      await service.signup({ username: "alice", password: "password123" });

      expect(bcrypt.hash).toHaveBeenCalledWith("password123", expect.any(Number));
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { username: "alice", password: "hashed-value" },
      });
    });

    it("translates a unique-constraint violation into a 409, not a raw 500", async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-value");
      prisma.user.create.mockRejectedValue({ code: "P2002" });

      await expect(service.signup({ username: "alice", password: "password123" })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("validateUser", () => {
    it("rejects missing credentials without ever querying the db", async () => {
      await expect(service.validateUser("", "")).rejects.toThrow(UnauthorizedException);
      expect(userService.findActiveByUsername).not.toHaveBeenCalled();
    });

    it("rejects an unknown username", async () => {
      userService.findActiveByUsername.mockResolvedValue(null);
      await expect(service.validateUser("ghost", "password123")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects an incorrect password", async () => {
      userService.findActiveByUsername.mockResolvedValue({
        id: "u1",
        password: "hashed-value",
        status: AccountStatus.ACTIVE,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser("alice", "wrong")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects immediately when the account is locked, without touching the db or bcrypt", async () => {
      redisClient.exists.mockResolvedValue(1);

      await expect(service.validateUser("alice", "password123")).rejects.toThrow(UnauthorizedException);
      expect(userService.findActiveByUsername).not.toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("locks the account after the failure threshold is reached", async () => {
      userService.findActiveByUsername.mockResolvedValue({
        id: "u1",
        password: "hashed-value",
        status: AccountStatus.ACTIVE,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      redisClient.incr.mockResolvedValue(LOGIN_FAIL_THRESHOLD);

      await expect(service.validateUser("alice", "wrong")).rejects.toThrow(UnauthorizedException);

      expect(redisClient.set).toHaveBeenCalledWith(
        "login:lock:alice",
        expect.any(String),
        "PX",
        expect.any(Number),
      );
    });

    it("does not lock the account before the failure threshold is reached", async () => {
      userService.findActiveByUsername.mockResolvedValue({
        id: "u1",
        password: "hashed-value",
        status: AccountStatus.ACTIVE,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      redisClient.incr.mockResolvedValue(LOGIN_FAIL_THRESHOLD - 1);

      await expect(service.validateUser("alice", "wrong")).rejects.toThrow(UnauthorizedException);
      expect(redisClient.set).not.toHaveBeenCalled();
    });

    it("rejects a dormant account even with the correct password", async () => {
      userService.findActiveByUsername.mockResolvedValue({
        id: "u1",
        password: "hashed-value",
        status: AccountStatus.DORMANT,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.validateUser("alice", "password123")).rejects.toThrow(ForbiddenException);
    });

    it("returns the public user shape on success", async () => {
      userService.findActiveByUsername.mockResolvedValue({
        id: "u1",
        username: "alice",
        password: "hashed-value",
        bio: null,
        status: AccountStatus.ACTIVE,
        createdAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser("alice", "password123");
      expect(result).toMatchObject({ id: "u1", username: "alice" });
      expect(result).not.toHaveProperty("password");
    });

    it("clears any accumulated failed-login count on success", async () => {
      userService.findActiveByUsername.mockResolvedValue({
        id: "u1",
        username: "alice",
        password: "hashed-value",
        bio: null,
        status: AccountStatus.ACTIVE,
        createdAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.validateUser("alice", "password123");

      expect(redisClient.del).toHaveBeenCalledWith("login:fails:alice", "login:lock:alice");
    });
  });

  describe("refresh", () => {
    it("rejects an invalid or expired refresh token", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("expired");
      });

      await expect(service.refresh("bad-token")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects and revokes the session when nothing is stored for this user", async () => {
      jwtService.verify.mockReturnValue({ sub: "u1", username: "alice" });
      redisClient.get.mockResolvedValue(null);

      await expect(service.refresh("token")).rejects.toThrow(UnauthorizedException);
      expect(redisClient.del).toHaveBeenCalledWith("refresh:u1");
    });

    it("rejects and revokes the whole session on reuse of a rotated-out token", async () => {
      // Simulates theft/replay: the stored hash no longer matches this
      // token because it was already rotated by a legitimate refresh.
      jwtService.verify.mockReturnValue({ sub: "u1", username: "alice" });
      redisClient.get.mockResolvedValue("some-other-hash");

      await expect(service.refresh("stale-token")).rejects.toThrow(UnauthorizedException);
      expect(redisClient.del).toHaveBeenCalledWith("refresh:u1");
    });

    it("rejects and revokes when the account went dormant after the token was issued", async () => {
      const token = "token";
      const matchingHash = createHash("sha256").update(token).digest("hex");
      jwtService.verify.mockReturnValue({ sub: "u1", username: "alice" });
      redisClient.get.mockResolvedValue(matchingHash);
      userService.findActiveById.mockResolvedValue({ id: "u1", username: "alice", status: AccountStatus.DORMANT });

      await expect(service.refresh(token)).rejects.toThrow(ForbiddenException);
      expect(redisClient.del).toHaveBeenCalledWith("refresh:u1");
    });

    it("issues a rotated token pair and overwrites the stored hash on success", async () => {
      const token = "token";
      const matchingHash = createHash("sha256").update(token).digest("hex");
      jwtService.verify.mockReturnValue({ sub: "u1", username: "alice" });
      redisClient.get.mockResolvedValue(matchingHash);
      userService.findActiveById.mockResolvedValue({ id: "u1", username: "alice", status: AccountStatus.ACTIVE });
      jwtService.sign.mockReturnValueOnce("new-access-token").mockReturnValueOnce("new-refresh-token");
      jwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      const result = await service.refresh(token);

      expect(result).toEqual({ accessToken: "new-access-token", refreshToken: "new-refresh-token" });
      expect(redisClient.set).toHaveBeenCalledWith("refresh:u1", expect.any(String), "PX", expect.any(Number));
      // The newly stored hash must correspond to the *new* refresh token,
      // not the one that was just consumed.
      const storedHash = redisClient.set.mock.calls[0][1];
      expect(storedHash).toBe(createHash("sha256").update("new-refresh-token").digest("hex"));
    });
  });

  describe("logout", () => {
    it("deletes the stored refresh session for the user", async () => {
      await service.logout("u1");
      expect(redisClient.del).toHaveBeenCalledWith("refresh:u1");
    });
  });
});
