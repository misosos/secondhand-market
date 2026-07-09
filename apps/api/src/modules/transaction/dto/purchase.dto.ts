import { IsUUID } from "class-validator";

export class PurchaseDto {
  @IsUUID()
  productId: string;
}
