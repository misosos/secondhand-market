import { IsEnum, IsOptional } from "class-validator";
import { AccountStatus } from "@secondhand/types";

export class AdminUserListQueryDto {
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}
