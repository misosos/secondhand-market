import { IsEnum } from "class-validator";
import { AccountStatus } from "@secondhand/types";

export class SetUserStatusDto {
  @IsEnum(AccountStatus)
  status: AccountStatus;
}
