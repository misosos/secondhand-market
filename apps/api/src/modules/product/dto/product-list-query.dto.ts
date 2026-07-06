import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { MAX_PAGE_SIZE } from "../product.constants";

export class ProductListQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsIn(["createdAt", "price"])
  sortBy?: "createdAt" | "price";

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}
