import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    return field && user ? user[field] : user;
  },
);
