import { IsInt, IsUUID, Max, Min } from "class-validator";
import { MAX_TRANSFER_WON } from "../../transaction/transaction.constants";

export class SendTransferDto {
  @IsUUID()
  roomId: string;

  @IsInt()
  @Min(1)
  @Max(MAX_TRANSFER_WON)
  amount: number;
}
