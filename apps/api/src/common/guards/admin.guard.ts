import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import { UserService } from "../../modules/user/user.service";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

// Runs after the global JwtAuthGuard (request.user is already populated).
// Re-reads the role from the DB rather than trusting a claim baked into the
// access token, so revoking admin rights takes effect immediately instead
// of waiting up to JWT_ACCESS_EXPIRES_IN for the old token to expire.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const payload = request.user as JwtPayload | undefined;
    if (!payload) throw new ForbiddenException("Admin access required");

    const user = await this.userService.findActiveById(payload.sub);
    if (!user || user.role !== Role.ADMIN) {
      throw new ForbiddenException("Admin access required");
    }
    return true;
  }
}
