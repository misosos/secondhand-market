import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserService } from "./user.service";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Declared before ':id' so '/users/me' resolves here, not as id="me".
  @Get("me")
  getMe(@CurrentUser("sub") userId: string) {
    return this.userService.getPublicProfile(userId);
  }

  @Patch("me")
  updateMe(@CurrentUser("sub") userId: string, @Body() dto: UpdateProfileDto) {
    return this.userService.updateBio(userId, dto);
  }

  @Patch("me/password")
  async changePassword(@CurrentUser("sub") userId: string, @Body() dto: ChangePasswordDto) {
    await this.userService.changePassword(userId, dto);
    return { success: true };
  }

  @Public()
  @Get(":id")
  getById(@Param("id") id: string) {
    return this.userService.getPublicSummary(id);
  }
}
