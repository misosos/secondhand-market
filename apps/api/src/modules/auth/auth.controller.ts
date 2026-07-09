import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import type { PublicUser } from "@secondhand/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AuthService, IssuedTokens } from "./auth.service";
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  LOGIN_THROTTLE,
  REFRESH_TOKEN_COOKIE,
  SIGNUP_THROTTLE,
} from "./auth.constants";
import { SignupDto } from "./dto/signup.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: SIGNUP_THROTTLE })
  @Post("signup")
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Throttle({ default: LOGIN_THROTTLE })
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(@CurrentUser() user: PublicUser, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(user);
    this.setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) throw new UnauthorizedException("Missing refresh token");

    const tokens = await this.authService.refresh(refreshToken);
    this.setAuthCookies(res, tokens);
    return { success: true };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(@CurrentUser("sub") userId: string, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(userId);
    this.clearAuthCookies(res);
  }

  private setAuthCookies(res: Response, tokens: IssuedTokens): void {
    const secure = this.configService.get<string>("NODE_ENV") === "production";

    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      expires: tokens.accessTokenExpiresAt,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      expires: tokens.refreshTokenExpiresAt,
    });
    // Re-issued alongside the auth cookies every login/refresh — see
    // CSRF_COOKIE's own comment in auth.constants.ts for why this one is
    // deliberately readable by JS.
    res.cookie(CSRF_COOKIE, randomUUID(), {
      httpOnly: false,
      secure,
      sameSite: "lax",
      path: "/",
      expires: tokens.refreshTokenExpiresAt,
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
    res.clearCookie(CSRF_COOKIE, { path: "/" });
  }
}
