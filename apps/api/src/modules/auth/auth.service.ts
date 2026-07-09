import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHash, randomUUID } from "crypto";
import type { AuthTokens, PublicUser } from "@secondhand/types";
import { AccountStatus } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { RedisService } from "../../infra/redis/redis.service";
import { loginFailKey, loginLockKey, refreshTokenKey } from "../../common/utils/redis-keys";
import { isUniqueConstraintError } from "../../common/utils/prisma-errors";
import { JwtPayload } from "../../common/interfaces/jwt-payload.interface";
import { UserService } from "../user/user.service";
import { SignupDto } from "./dto/signup.dto";
import {
  BCRYPT_SALT_ROUNDS,
  LOGIN_FAIL_THRESHOLD,
  LOGIN_FAIL_WINDOW_MS,
  LOGIN_LOCK_DURATION_MS,
} from "./auth.constants";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          password: passwordHash,
          // Virtual starting balance — there's no real payment gateway
          // backing this wallet, see the note on User.balance in schema.prisma.
          balance: this.configService.get<number>("SIGNUP_INITIAL_BALANCE")!,
        },
      });
      return this.userService.toPublicUser(user);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Username already taken");
      }
      throw error;
    }
  }

  async validateUser(username: string, password: string): Promise<PublicUser> {
    // Passport's local strategy runs before our ValidationPipe, so a
    // malformed body can reach here with non-string fields. Prisma treats
    // `undefined` filter values as "omit this condition", so an unguarded
    // undefined username would silently match the first user in the table
    // instead of failing — reject early instead.
    if (!username || !password) {
      throw new UnauthorizedException("Invalid username or password");
    }

    if (await this.redisService.client.exists(loginLockKey(username))) {
      throw new UnauthorizedException("Too many failed attempts. Try again later.");
    }

    const user = await this.userService.findActiveByUsername(username);
    const passwordOk = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !passwordOk) {
      await this.registerFailedLogin(username);
      throw new UnauthorizedException("Invalid username or password");
    }

    // Correct password proves this wasn't a brute-force guess, regardless
    // of what happens next (e.g. the dormant check below) — clear the
    // counter so a legitimate user isn't left one attempt away from
    // locking themselves out.
    await this.clearFailedLogins(username);

    if (user.status === AccountStatus.DORMANT) {
      throw new ForbiddenException("Dormant accounts cannot log in");
    }

    return this.userService.toPublicUser(user);
  }

  private async registerFailedLogin(username: string): Promise<void> {
    const key = loginFailKey(username);
    const fails = await this.redisService.client.incr(key);
    if (fails === 1) {
      await this.redisService.client.pexpire(key, LOGIN_FAIL_WINDOW_MS);
    }
    if (fails >= LOGIN_FAIL_THRESHOLD) {
      await this.redisService.client.set(loginLockKey(username), "1", "PX", LOGIN_LOCK_DURATION_MS);
    }
  }

  private async clearFailedLogins(username: string): Promise<void> {
    await this.redisService.client.del(loginFailKey(username), loginLockKey(username));
  }

  login(user: PublicUser): Promise<AuthTokens> {
    return this.issueTokens(user.id, user.username);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const key = refreshTokenKey(payload.sub);
    const storedHash = await this.redisService.client.get(key);

    if (!storedHash || storedHash !== this.hashToken(refreshToken)) {
      // No active session, or this token was already rotated out (reuse of
      // a stale token) — treat as possible theft and kill the session.
      await this.redisService.client.del(key);
      throw new UnauthorizedException("Refresh token no longer valid");
    }

    const user = await this.userService.findActiveById(payload.sub);
    if (!user || user.status === AccountStatus.DORMANT) {
      await this.redisService.client.del(key);
      throw new ForbiddenException("Account is no longer active");
    }

    return this.issueTokens(user.id, user.username);
  }

  async logout(userId: string): Promise<void> {
    await this.redisService.client.del(refreshTokenKey(userId));
  }

  private async issueTokens(userId: string, username: string): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, username };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRES_IN"),
      // Without a unique jti, two rotations within the same wall-clock
      // second produce byte-identical tokens (JWT signing is deterministic),
      // which would silently defeat reuse detection on rapid refreshes.
      jwtid: randomUUID(),
    });

    // Read the actual `exp` claim back off the token rather than
    // re-parsing JWT_REFRESH_EXPIRES_IN, so the Redis TTL can never drift
    // from what the token itself asserts.
    const decoded = this.jwtService.decode(refreshToken) as { exp: number };
    const ttlMs = decoded.exp * 1000 - Date.now();

    await this.redisService.client.set(refreshTokenKey(userId), this.hashToken(refreshToken), "PX", ttlMs);

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
