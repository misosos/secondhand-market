import { IsUUID } from "class-validator";

// Shared shape for both 받기 (accept) and 거절 (reject) — both just
// identify which TRANSFER message they're deciding on.
export class TransferDecisionDto {
  @IsUUID()
  messageId: string;
}
