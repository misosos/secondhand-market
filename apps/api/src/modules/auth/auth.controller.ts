import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { PublicUser } from "@secondhand/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AuthService } from "./auth.service";
import { LOGIN_THROTTLE, SIGNUP_THROTTLE } from "./auth.constants";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { SignupDto } from "./dto/signup.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async login(@CurrentUser() user: PublicUser) {
    const tokens = await this.authService.login(user);
    return { ...tokens, user };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(@CurrentUser("sub") userId: string) {
    await this.authService.logout(userId);
  }
}
