import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { CHAT_HISTORY_MAX_PAGE_SIZE } from "../chat.constants";

export class ChatHistoryQueryDto {
  @IsUUID()
  roomId: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CHAT_HISTORY_MAX_PAGE_SIZE)
  limit?: number;
}
